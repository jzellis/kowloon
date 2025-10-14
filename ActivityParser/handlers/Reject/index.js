// /ActivityParser/handlers/Reject/index.js

import { Event, Group, Circle } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Reject(activity) {
  try {
    // ---- Basic validation ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Reject: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error: "Reject: missing or malformed activity.target",
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
      // Remote target → no local mutation; let upstream federate.
      return { activity, federate: true };
    }

    // ---- Deleted guard ----
    if (eventDoc?.deletedAt)
      return { activity, error: "Reject: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Reject: group is deleted" };

    // Actor locality (for federate flag only; we still mutate local targets)
    const actorLocal = await objectById(activity.actorId);
    const parsedActor = kowloonId(activity.actorId);

    // Helpers
    const pullMember = async (circleId, userId, label, removed) => {
      if (!circleId) return removed;
      const res = await Circle.updateOne(
        { id: circleId, "members.id": userId },
        { $pull: { members: { id: userId } }, $set: { updatedAt: new Date() } }
      );
      if (res.modifiedCount > 0) removed.push(label);
      return removed;
    };

    const removedFrom = [];
    const actorId = activity.actorId;

    if (targetType === "Event") {
      // Remove from participation-like circles
      const { invited, interested, attending } = eventDoc;
      if (!invited && !interested && !attending) {
        return { activity, error: "Reject: event circles not initialized" };
      }

      await pullMember(invited, actorId, "invited", removedFrom);
      await pullMember(interested, actorId, "interested", removedFrom);
      await pullMember(attending, actorId, "attending", removedFrom);

      // annotate for Undo & downstreams
      activity.objectId = actorId;
      activity.sideEffects = {
        removedFrom,
        memberId: actorId,
        eventId: eventDoc.id,
        circleIds: { invited, interested, attending },
      };

      return {
        activity,
        event: eventDoc,
        rejected: removedFrom.length > 0,
        removedFrom,
        federate: !actorLocal, // if actor isn't local, ask upstream to federate this Reject
      };
    }

    // Group: remove from invited & members (do not touch admins/moderators/blocked)
    const { invited, members } = groupDoc;
    if (!invited && !members) {
      return { activity, error: "Reject: group circles not initialized" };
    }

    await pullMember(invited, actorId, "invited", removedFrom);
    await pullMember(members, actorId, "members", removedFrom);

    // annotate for Undo & downstreams
    activity.objectId = actorId;
    activity.sideEffects = {
      removedFrom,
      memberId: actorId,
      groupId: groupDoc.id,
      circleIds: { invited, members },
    };

    return {
      activity,
      group: groupDoc,
      rejected: removedFrom.length > 0,
      removedFrom,
      federate: !actorLocal,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
