// /ActivityParser/handlers/Accept/index.js

import { Event, Group, Circle } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Accept(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Accept: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error: "Accept: missing or malformed activity.target",
      };
    }

    // Optional state hint for Events: "Attending" | "Interested" (default "Attending")
    const desiredState =
      (activity?.object &&
        typeof activity.object === "object" &&
        activity.object.state) ||
      (activity?.objectType &&
        /^(Attending|Interested)$/i.test(activity.objectType) &&
        activity.objectType) ||
      "Attending";
    const state =
      String(desiredState).toLowerCase() === "interested"
        ? "Interested"
        : "Attending";

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
      return { activity, error: "Accept: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Accept: group is deleted" };

    // ---- Locality of actor: used only for federate flag (mutations still proceed if target is local) ----
    const actorLocal = await objectById(activity.actorId); // null if remote/unknown
    const parsedActor = kowloonId(activity.actorId);

    // Helper to build a Member payload for circle pushes
    const asMember = actorLocal
      ? {
          id: actorLocal.id,
          name: actorLocal?.profile?.name,
          url: actorLocal?.url,
          icon: actorLocal?.profile?.icon,
          inbox: actorLocal?.inbox,
          outbox: actorLocal?.outbox,
          server: actorLocal?.server ?? parsedActor?.domain,
        }
      : {
          id: activity.actorId,
          server: parsedActor?.domain,
          url: parsedActor?.type === "URL" ? activity.actorId : undefined,
        };

    // ---- Circle helpers ----
    const isMember = async (circleId, userId) =>
      !!(
        circleId &&
        userId &&
        (await Circle.findOne({ id: circleId, "members.id": userId }).lean())
      );
    const pullMember = async (circleId, userId) =>
      circleId
        ? Circle.updateOne(
            { id: circleId, "members.id": userId },
            {
              $pull: { members: { id: userId } },
              $set: { updatedAt: new Date() },
            }
          )
        : { modifiedCount: 0 };
    const addMemberIfMissing = async (circleId, m) =>
      circleId
        ? Circle.findOneAndUpdate(
            { id: circleId, "members.id": { $ne: m.id } },
            { $push: { members: m }, $set: { updatedAt: new Date() } },
            { new: true }
          )
        : null;

    // ========================================================================
    // EVENT ACCEPT
    // - Move from invited → attending|interested
    // - Also allow interested → attending
    // - Blocked users cannot accept
    // - Record sideEffects for Undo
    // ========================================================================
    if (targetType === "Event") {
      const adminsId = eventDoc.admins;
      const invitedId = eventDoc.invited;
      const interestedId = eventDoc.interested;
      const attendingId = eventDoc.attending;
      const blockedId = eventDoc.blocked;

      if (!invitedId || !interestedId || !attendingId) {
        return { activity, error: "Accept: event circles not initialized" };
      }

      if (blockedId && (await isMember(blockedId, activity.actorId))) {
        return { activity, error: "Accept: you are blocked from this event" };
      }

      const inInvited = await isMember(invitedId, activity.actorId);
      const inInterested = await isMember(interestedId, activity.actorId);
      const inAttending = await isMember(attendingId, activity.actorId);

      // Already at destination → idempotent no-op
      if (
        (state === "Interested" && inInterested) ||
        (state === "Attending" && inAttending)
      ) {
        activity.objectId = activity.actorId;
        return {
          activity,
          event: eventDoc,
          accepted: false,
          movedTo: state,
          federate: false,
        };
      }

      // Allowed sources:
      // - invited → interested|attending
      // - interested → attending
      const allowed = inInvited || (state === "Attending" && inInterested);
      if (!allowed) {
        return {
          activity,
          error: "Accept: no pending invite found for this transition",
        };
      }

      // Pull from source circles as needed, push to destination
      let from = null;
      let fromCircleId = null;
      if (inInvited) {
        await pullMember(invitedId, activity.actorId);
        from = "invited";
        fromCircleId = invitedId;
      }
      if (state === "Attending" && inInterested) {
        await pullMember(interestedId, activity.actorId);
        from = from || "interested";
        fromCircleId = fromCircleId || interestedId;
      }

      const toCircleId = state === "Interested" ? interestedId : attendingId;
      const pushed = await addMemberIfMissing(toCircleId, asMember);
      if (!pushed) {
        return { activity, error: "Accept: failed to update event circles" };
      }

      // annotate for downstreams + Undo
      activity.objectId = activity.actorId;
      activity.sideEffects = {
        from: from || "invited",
        to: state, // "Interested" | "Attending"
        fromCircleId: fromCircleId || invitedId,
        toCircleId,
        memberId: activity.actorId,
      };

      return {
        activity,
        event: eventDoc,
        accepted: true,
        movedTo: state,
        federate: !actorLocal, // federate if the accepting actor isn't local
      };
    }

    // ========================================================================
    // GROUP ACCEPT
    // - Move from invited → members
    // - Blocked users cannot accept
    // - Record sideEffects for Undo
    // ========================================================================
    const adminsId = groupDoc.admins;
    const membersId = groupDoc.members;
    const invitedId = groupDoc.invited;
    const blockedId = groupDoc.blocked;

    if (!membersId || !invitedId) {
      return { activity, error: "Accept: group circles not initialized" };
    }

    if (blockedId && (await isMember(blockedId, activity.actorId))) {
      return { activity, error: "Accept: you are blocked from this group" };
    }

    const inMembers = await isMember(membersId, activity.actorId);
    const inInvited = await isMember(invitedId, activity.actorId);

    if (inMembers) {
      activity.objectId = activity.actorId;
      return {
        activity,
        group: groupDoc,
        accepted: false,
        movedTo: "Members",
        federate: false,
      };
    }
    if (!inInvited) {
      return { activity, error: "Accept: no pending invite found" };
    }

    await pullMember(invitedId, activity.actorId);
    const pushed = await addMemberIfMissing(membersId, asMember);
    if (!pushed) {
      return { activity, error: "Accept: failed to update group circles" };
    }

    // annotate for downstreams + Undo
    activity.objectId = activity.actorId;
    activity.sideEffects = {
      from: "invited",
      to: "Members",
      fromCircleId: invitedId,
      toCircleId: membersId,
      memberId: activity.actorId,
    };

    return {
      activity,
      group: groupDoc,
      accepted: true,
      movedTo: "Members",
      federate: !actorLocal, // federate if the accepting actor isn't local
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
