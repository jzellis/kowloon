// Leave: actor exits an Event or Group they're part of.
// Event: remove from Attending and Interested (and Invited, if present).
// Group: remove from Members (and Invited, if present).
// Idempotent; records which circles were touched in sideEffects.

import { Event, Group, Circle } from "#schema";

export default async function Leave(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Leave: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Leave: missing or malformed activity.target" };
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
      return { activity, error: "Leave: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Leave: group is deleted" };

    // ---- Helpers ----
    const pull = async (circleId, userId) =>
      circleId
        ? Circle.updateOne(
            { id: circleId, "members.id": userId },
            {
              $pull: { members: { id: userId } },
              $set: { updatedAt: new Date() },
            }
          )
        : { modifiedCount: 0 };

    const removedFrom = [];

    // ========================================================================
    // EVENT LEAVE
    // ========================================================================
    if (targetType === "Event") {
      const { invited, interested, attending } = eventDoc;
      if (!interested || !attending) {
        return { activity, error: "Leave: event circles not initialized" };
      }

      const ops = await Promise.all([
        pull(attending, activity.actorId),
        pull(interested, activity.actorId),
        pull(invited, activity.actorId),
      ]);

      if ((ops[0].modifiedCount || 0) > 0) removedFrom.push("attending");
      if ((ops[1].modifiedCount || 0) > 0) removedFrom.push("interested");
      if ((ops[2].modifiedCount || 0) > 0) removedFrom.push("invited");

      // annotate for Undo (note: "Leave" undo is optional / policy-dependent)
      activity.objectId = activity.actorId;

      return {
        activity,
        event: eventDoc,
        left: removedFrom.length > 0,
        removedFrom,
        federate: false, // we can choose to federate user-initiated Leave later
      };
    }

    // ========================================================================
    // GROUP LEAVE
    // ========================================================================
    const { invited, members } = groupDoc;
    if (!members) {
      return { activity, error: "Leave: group circles not initialized" };
    }

    const ops = await Promise.all([
      pull(members, activity.actorId),
      pull(invited, activity.actorId),
    ]);

    if ((ops[0].modifiedCount || 0) > 0) removedFrom.push("members");
    if ((ops[1].modifiedCount || 0) > 0) removedFrom.push("invited");

    activity.objectId = activity.actorId;

    return {
      activity,
      group: groupDoc,
      left: removedFrom.length > 0,
      removedFrom,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
