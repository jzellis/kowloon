// /ActivityParser/handlers/Leave/index.js

import { Circle, User } from "#schema";

export default async function Leave(activity) {
  try {
    // Basic validations
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Leave: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return { activity, error: "Leave: missing or malformed activity.object" };
    }
    if (activity.target && typeof activity.target !== "string") {
      return { activity, error: "Leave: malformed activity.target" };
    }

    // Ensure the unfollowing user exists (mainly to guard owner lookups)
    const unfollower = await User.findOne({ id: activity.actorId }).lean();
    if (!unfollower) {
      return { activity, error: `Leave: user not found: ${activity.actorId}` };
    }

    const memberId = activity.object;

    // Case A: remove from a specific circle (activity.target provided)
    if (activity.target) {
      const circleId = activity.target;

      // First, do a conditional pull to know if anything was actually removed
      const res = await Circle.updateOne(
        { id: circleId, "members.id": memberId },
        {
          $pull: { members: { id: memberId } },
          $set: { updatedAt: new Date() },
        }
      );

      // Fetch the latest circle state to return a consistent payload
      const circle = await Circle.findOne({ id: circleId });

      if (!circle) {
        return {
          activity,
          error: `Leave: target circle not found: ${circleId}`,
        };
      }

      const removed = res.modifiedCount > 0;

      // annotate for downstreams
      activity.target = circle.id;
      activity.objectId = memberId;

      return { activity, circle, removed };
    }

    // Case B: no target → remove from all circles owned by the unfollowing user
    // We don’t create or assume any circles here; if the user owns none, nothing happens.
    const res = await Circle.updateMany(
      { ownerId: activity.actorId, "members.id": memberId },
      { $pull: { members: { id: memberId } }, $set: { updatedAt: new Date() } }
    );

    // Fetch all circles for the owner (post-update) to return a consistent snapshot
    const circles = await Circle.find({ ownerId: activity.actorId });

    // annotate for downstreams
    activity.objectId = memberId;

    return {
      activity,
      circles,
      removedCount: res.modifiedCount || 0,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
