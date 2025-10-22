// /ActivityParser/handlers/Unfollow/index.js
import { Circle, User } from "#schema";

export default async function Unfollow(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Unfollow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return {
        activity,
        error:
          "Unfollow: missing or malformed activity.object (actorId to unfollow)",
      };
    }

    // ---- Load actor & resolve target circle ----
    const actor = await User.findOne({ id: activity.actorId }).lean();
    if (!actor) return { activity, error: "Unfollow: actor not found" };

    const target = activity.target || actor.following;
    if (!target || typeof target !== "string") {
      return {
        activity,
        error:
          "Unfollow: no target circle provided and no default following circle on actor",
      };
    }
    if (!target.startsWith("circle:")) {
      return { activity, error: "Unfollow: target must be a circle id" };
    }

    // ---- Load target circle and enforce ownership (actors may only edit their own circles) ----
    const targetCircle = await Circle.findOne({ id: target }).lean();
    if (!targetCircle)
      return { activity, error: "Unfollow: target circle not found" };
    if (targetCircle.actorId !== actor.id) {
      return {
        activity,
        error: "Unfollow: cannot remove members from a circle you do not own",
      };
    }

    // ---- Prevent self-unfollow (no-op or explicit error)
    if (activity.object === activity.actorId) {
      return { activity, error: "Unfollow: cannot unfollow yourself" };
    }

    const memberId = activity.object;

    // ---- Atomic remove (only if present), decrement memberCount ----
    const res = await Circle.updateOne(
      { id: target, "members.id": memberId },
      { $pull: { members: { id: memberId } }, $inc: { memberCount: -1 } }
    );

    const didRemove = (res.modifiedCount || 0) > 0;
    return {
      activity,
      circleId: target,
      unfollowed: didRemove,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
