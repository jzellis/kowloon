// /ActivityParser/handlers/Remove/index.js

import { Event, Group, Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Remove(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Remove: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error: "Remove: missing or malformed activity.target",
      };
    }
    if (!activity?.to || typeof activity.to !== "string") {
      return {
        activity,
        error: "Remove: missing or malformed activity.to (user to remove)",
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
        error: "Remove: missing activity.object.role (admin|moderator)",
      };
    }
    const role = roleRaw.trim().toLowerCase();
    if (!["admin", "moderator"].includes(role)) {
      return {
        activity,
        error: `Remove: unsupported role "${roleRaw}" (use "admin" or "moderator")`,
      };
    }

    // ---- Resolve local target (Event or Group). If not found → federate only. ----
    let targetType = null;
    let eventDoc = await Event.findOne({ id: activity.target });
    let groupDoc = null;

    if (eventDoc) targetType = "Event";
    else {
      groupDoc = await Group.findOne({ id: activity.target });
      if (groupDoc) targetType = "Group";
    }

    if (!targetType) {
      // Remote target → do not mutate locally; let upstream federate.
      return { activity, federate: true };
    }

    // ---- Deleted guard ----
    if (eventDoc?.deletedAt)
      return { activity, error: "Remove: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Remove: group is deleted" };

    // ---- Load actor (must exist locally) ----
    const actor = await User.findOne({ id: activity.actorId }).lean();
    if (!actor)
      return {
        activity,
        error: `Remove: actor user not found: ${activity.actorId}`,
      };

    const subjectId = activity.to;
    const subjectLocal = await objectById(subjectId); // null if remote/unknown
    const subjectParsed = kowloonId(subjectId);

    // ---- Circle helpers ----
    const isMember = async (circleId, userId) =>
      !!(
        circleId &&
        userId &&
        (await Circle.findOne({ id: circleId, "members.id": userId }).lean())
      );

    const getMemberDoc = async (circleId, userId) => {
      if (!circleId || !userId) return null;
      const circle = await Circle.findOne(
        { id: circleId, "members.id": userId },
        { "members.$": 1, id: 1 }
      ).lean();
      return circle?.members?.[0] || null;
    };

    const pullMember = async (circleId, userId) =>
      Circle.updateOne(
        { id: circleId, "members.id": userId },
        { $pull: { members: { id: userId } }, $set: { updatedAt: new Date() } }
      );

    // ========================================================================
    // EVENT: only "admin" is valid here (no moderators circle on Events)
    // ========================================================================
    if (targetType === "Event") {
      if (role === "moderator") {
        return {
          activity,
          error: "Remove: events do not have a moderators circle",
        };
      }

      const adminsId = eventDoc.admins;
      if (!adminsId)
        return { activity, error: "Remove: event circles not initialized" };

      // Permission: actor must be an event admin
      const actorIsAdmin = await isMember(adminsId, activity.actorId);
      if (!actorIsAdmin) {
        return {
          activity,
          error: "Remove: only event admins can remove admins",
        };
      }

      // If not currently an admin → no-op
      const already = await isMember(adminsId, subjectId);
      if (!already) {
        activity.objectId = subjectId;
        return {
          activity,
          event: eventDoc,
          removed: false,
          circle: "admins",
          federate: false,
        };
      }

      // Capture member subdoc for Undo before pulling
      const memberSubdoc = await getMemberDoc(adminsId, subjectId);

      const res = await pullMember(adminsId, subjectId);
      const removed = (res.modifiedCount || 0) > 0;

      activity.objectId = subjectId;

      // Side effects for Undo (only if we actually removed)
      if (removed) {
        activity.sideEffects = {
          circleId: adminsId,
          role: "admin",
          member: memberSubdoc || {
            id: subjectId,
            server: subjectParsed?.domain,
          },
        };
      }

      return {
        activity,
        event: eventDoc,
        removed,
        circle: "admins",
        federate: !subjectLocal, // federate if the removed user isn't local
      };
    }

    // ========================================================================
    // GROUP: "admin" or "moderator"
    // ========================================================================
    const adminsId = groupDoc.admins;
    const moderatorsId = groupDoc.moderators;

    if (!adminsId || !moderatorsId) {
      return { activity, error: "Remove: group circles not initialized" };
    }

    // Permission: actor must be a group admin (mods cannot demote)
    const actorIsAdmin = await isMember(adminsId, activity.actorId);
    if (!actorIsAdmin) {
      return {
        activity,
        error: "Remove: only group admins can remove admins or moderators",
      };
    }

    const destCircle = role === "admin" ? adminsId : moderatorsId;
    const destLabel = role === "admin" ? "admins" : "moderators";

    // If not present → no-op
    const already = await isMember(destCircle, subjectId);
    if (!already) {
      activity.objectId = subjectId;
      return {
        activity,
        group: groupDoc,
        removed: false,
        circle: destLabel,
        federate: false,
      };
    }

    // Capture member subdoc for Undo before pulling
    const memberSubdoc = await getMemberDoc(destCircle, subjectId);

    const res = await pullMember(destCircle, subjectId);
    const removed = (res.modifiedCount || 0) > 0;

    activity.objectId = subjectId;

    // Side effects for Undo (only if we actually removed)
    if (removed) {
      activity.sideEffects = {
        circleId: destCircle,
        role,
        member: memberSubdoc || {
          id: subjectId,
          server: subjectParsed?.domain,
        },
      };
    }

    return {
      activity,
      group: groupDoc,
      removed,
      circle: destLabel,
      federate: !subjectLocal, // federate if the removed user isn't local
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
