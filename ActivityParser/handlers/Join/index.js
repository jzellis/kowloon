// Join: user opts in to an Event/Group.
// Event: adds actor to Interested by default (or Attending if object.state === "Attending").
//        If invited, behaves like Accept (moves from Invited).
// Group: for now, require an invite (policy for open vs invite-only to come later).
//        If invited, behaves like Accept (Invited -> Members).

import { Event, Group, Circle } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Join(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Join: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Join: missing or malformed activity.target" };
    }

    // Optional state for Events
    const desiredState =
      (activity?.object &&
        typeof activity.object === "object" &&
        activity.object.state) ||
      (activity?.objectType &&
        /^(Attending|Interested)$/i.test(activity.objectType) &&
        activity.objectType) ||
      "Interested";
    const state =
      String(desiredState).toLowerCase() === "attending"
        ? "Attending"
        : "Interested";

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
      return { activity, error: "Join: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Join: group is deleted" };

    // ---- Locality of actor (for federate hint only) ----
    const actorLocal = await objectById(activity.actorId);
    const parsedActor = kowloonId(activity.actorId);

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
    // EVENT JOIN
    // - Blocked users cannot join
    // - If invited: Invited -> Interested (default) or -> Attending if state=Attending
    // - If not invited: add to Interested (policy for open/invite-only later)
    // ========================================================================
    if (targetType === "Event") {
      const invitedId = eventDoc.invited;
      const interestedId = eventDoc.interested;
      const attendingId = eventDoc.attending;
      const blockedId = eventDoc.blocked;

      if (!invitedId || !interestedId || !attendingId) {
        return { activity, error: "Join: event circles not initialized" };
      }

      if (blockedId && (await isMember(blockedId, activity.actorId))) {
        return { activity, error: "Join: you are blocked from this event" };
      }

      const inInvited = await isMember(invitedId, activity.actorId);
      const inInterested = await isMember(interestedId, activity.actorId);
      const inAttending = await isMember(attendingId, activity.actorId);

      // Already there → idempotent no-op
      if (
        (state === "Interested" && inInterested) ||
        (state === "Attending" && inAttending)
      ) {
        activity.objectId = activity.actorId;
        return {
          activity,
          event: eventDoc,
          joined: false,
          movedTo: state,
          federate: false,
        };
      }
      if (inAttending && state === "Interested") {
        // Already attending; no downgrade via Join
        activity.objectId = activity.actorId;
        return {
          activity,
          event: eventDoc,
          joined: false,
          movedTo: "Attending",
          federate: false,
        };
      }

      let from = null;
      let fromCircleId = null;

      if (inInvited) {
        await pullMember(invitedId, activity.actorId);
        from = "invited";
        fromCircleId = invitedId;
      }

      const toCircleId = state === "Attending" ? attendingId : interestedId;
      const pushed = await addMemberIfMissing(toCircleId, asMember);
      if (!pushed) {
        return { activity, error: "Join: failed to update event circles" };
      }

      // annotate for Undo
      activity.objectId = activity.actorId;
      activity.sideEffects = {
        from: from || (inInterested ? "interested" : null),
        to: state,
        fromCircleId: fromCircleId || (inInterested ? interestedId : null),
        toCircleId,
        memberId: activity.actorId,
      };

      return {
        activity,
        event: eventDoc,
        joined: true,
        movedTo: state,
        federate: !actorLocal, // if actor isn't local, offer federation
      };
    }

    // ========================================================================
    // GROUP JOIN
    // - For now: require an invite (we'll add open policy later)
    // - Invited -> Members
    // ========================================================================
    const invitedId = groupDoc.invited;
    const membersId = groupDoc.members;
    const blockedId = groupDoc.blocked;

    if (!invitedId || !membersId) {
      return { activity, error: "Join: group circles not initialized" };
    }

    if (blockedId && (await isMember(blockedId, activity.actorId))) {
      return { activity, error: "Join: you are blocked from this group" };
    }

    const inMembers = await isMember(membersId, activity.actorId);
    if (inMembers) {
      activity.objectId = activity.actorId;
      return {
        activity,
        group: groupDoc,
        joined: false,
        movedTo: "Members",
        federate: false,
      };
    }

    const inInvited = await isMember(invitedId, activity.actorId);
    if (!inInvited) {
      return {
        activity,
        error: "Join: invite required (open policy not configured yet)",
      };
    }

    await pullMember(invitedId, activity.actorId);
    const pushed = await addMemberIfMissing(membersId, asMember);
    if (!pushed) {
      return { activity, error: "Join: failed to update group circles" };
    }

    // annotate for Undo
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
      joined: true,
      movedTo: "Members",
      federate: !actorLocal,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
