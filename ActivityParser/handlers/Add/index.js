import { Event, Group, Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Add(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Add: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Add: missing or malformed activity.target" };
    }
    if (!activity?.to || typeof activity.to !== "string") {
      return {
        activity,
        error: "Add: missing or malformed activity.to (user to add)",
      };
    }

    const roleRaw =
      (activity?.object &&
        typeof activity.object === "object" &&
        activity.object.role) ||
      (activity?.objectType && activity.objectType);
    if (!roleRaw || typeof roleRaw !== "string") {
      return {
        activity,
        error: "Add: missing activity.object.role (admin|moderator)",
      };
    }

    const role = roleRaw.trim().toLowerCase();
    if (!["admin", "moderator"].includes(role)) {
      return {
        activity,
        error: `Add: unsupported role "${roleRaw}" (use 'admin' or 'moderator')`,
      };
    }

    // ---- Resolve target (Event or Group). If not local → federate only ----
    let targetType = null;
    let eventDoc = await Event.findOne({ id: activity.target });
    let groupDoc = null;

    if (eventDoc) targetType = "Event";
    else {
      groupDoc = await Group.findOne({ id: activity.target });
      if (groupDoc) targetType = "Group";
    }

    if (!targetType) return { activity, federate: true };

    // ---- Deleted guards ----
    if (eventDoc?.deletedAt)
      return { activity, error: "Add: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Add: group is deleted" };

    // ---- Load actor ----
    const actor = await User.findOne({ id: activity.actorId }).lean();
    if (!actor)
      return { activity, error: `Add: actor not found: ${activity.actorId}` };

    // ---- Resolve subject (user to add) ----
    const subjectId = activity.to;
    const subjectLocal = await objectById(subjectId);
    const subjectParsed = kowloonId(subjectId);

    const member = subjectLocal
      ? {
          id: subjectLocal.id,
          name: subjectLocal?.profile?.name,
          url: subjectLocal?.url,
          icon: subjectLocal?.profile?.icon,
          inbox: subjectLocal?.inbox,
          outbox: subjectLocal?.outbox,
          server: subjectLocal?.server ?? subjectParsed?.domain,
        }
      : {
          id: subjectId,
          url: subjectParsed?.type === "URL" ? subjectId : undefined,
          server: subjectParsed?.domain,
        };

    // ---- Helper utilities ----
    const isMember = async (circleId, userId) =>
      !!(
        circleId &&
        userId &&
        (await Circle.findOne({ id: circleId, "members.id": userId }).lean())
      );

    const addMemberIfMissing = async (circleId, m) =>
      Circle.findOneAndUpdate(
        { id: circleId, "members.id": { $ne: m.id } },
        { $push: { members: m }, $set: { updatedAt: new Date() } },
        { new: true }
      );

    // =====================================================================
    // EVENT
    // =====================================================================
    if (targetType === "Event") {
      if (role === "moderator") {
        return {
          activity,
          error: "Add: events do not support a moderators circle",
        };
      }

      const adminsId = eventDoc.admins;
      const blockedId = eventDoc.blocked;
      if (!adminsId)
        return { activity, error: "Add: event circles not initialized" };

      const actorIsAdmin = await isMember(adminsId, activity.actorId);
      if (!actorIsAdmin)
        return { activity, error: "Add: only event admins can add admins" };

      if (blockedId && (await isMember(blockedId, subjectId))) {
        return { activity, error: "Add: user is blocked from this event" };
      }

      const already = await isMember(adminsId, subjectId);
      if (already) {
        activity.objectId = subjectId;
        return {
          activity,
          event: eventDoc,
          added: false,
          circle: "admins",
          federate: false,
        };
      }

      const updatedCircle = await addMemberIfMissing(adminsId, member);
      if (!updatedCircle)
        return { activity, error: "Add: failed to update event admins circle" };

      // annotate for Undo
      activity.objectId = subjectId;
      activity.sideEffects = {
        circleId: adminsId,
        memberId: subjectId,
        role: "admin",
      };

      return {
        activity,
        event: eventDoc,
        added: true,
        circle: "admins",
        federate: !subjectLocal,
      };
    }

    // =====================================================================
    // GROUP
    // =====================================================================
    const adminsId = groupDoc.admins;
    const moderatorsId = groupDoc.moderators;
    const blockedId = groupDoc.blocked;

    if (!adminsId || !moderatorsId)
      return { activity, error: "Add: group circles not initialized" };

    const actorIsAdmin = await isMember(adminsId, activity.actorId);
    if (!actorIsAdmin)
      return {
        activity,
        error: "Add: only group admins can add admins or moderators",
      };

    if (blockedId && (await isMember(blockedId, subjectId))) {
      return { activity, error: "Add: user is blocked from this group" };
    }

    const destCircle = role === "admin" ? adminsId : moderatorsId;
    const destLabel = role === "admin" ? "admins" : "moderators";

    const already = await isMember(destCircle, subjectId);
    if (already) {
      activity.objectId = subjectId;
      return {
        activity,
        group: groupDoc,
        added: false,
        circle: destLabel,
        federate: false,
      };
    }

    const updatedCircle = await addMemberIfMissing(destCircle, member);
    if (!updatedCircle) {
      return {
        activity,
        error: `Add: failed to update group ${destLabel} circle`,
      };
    }

    // annotate for Undo
    activity.objectId = subjectId;
    activity.sideEffects = {
      circleId: destCircle,
      memberId: subjectId,
      role,
    };

    return {
      activity,
      group: groupDoc,
      added: true,
      circle: destLabel,
      federate: !subjectLocal,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
