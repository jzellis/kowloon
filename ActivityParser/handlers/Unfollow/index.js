// /ActivityParser/handlers/Unfollow/index.js
import { Circle, User } from "#schema";

function normalizeUnfollowObject(obj) {
  if (typeof obj === "string") return { actorId: obj, id: obj, type: "User" };
  if (obj && typeof obj === "object") {
    const actorId = obj.actorId || obj.id;
    if (typeof actorId === "string" && actorId.trim()) {
      return {
        ...obj,
        actorId,
        id: obj.id || actorId,
        type: obj.type || "User",
      };
    }
  }
  return null;
}

export default async function Unfollow(activity) {
  try {
    // ---- Basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Unfollow: missing activity.actorId" };
    }
    const norm = normalizeUnfollowObject(activity.object);
    if (!norm) {
      return {
        activity,
        error:
          "Unfollow: missing/malformed activity.object (string or {actorId})",
      };
    }
    activity.object = norm;

    // Ensure actor exists (and to make owner checks clearer)
    const actor = await User.findOne({ id: activity.actorId }).lean();
    if (!actor) {
      return {
        activity,
        error: `Unfollow: actor not found: ${activity.actorId}`,
      };
    }

    const memberId = norm.actorId;

    // ---- Case A: specific circle (must be user-owned) ----
    if (activity.target) {
      if (typeof activity.target !== "string") {
        return {
          activity,
          error:
            "Unfollow: malformed activity.target (circle id string expected)",
        };
      }

      const circle = await Circle.findOne({ id: activity.target }).lean(false);
      if (!circle) {
        return {
          activity,
          error: `Unfollow: target circle not found: ${activity.target}`,
        };
      }
      if (circle.actorId !== activity.actorId) {
        return {
          activity,
          error: `Unfollow: target circle not owned by actor (${circle.actorId} != ${activity.actorId})`,
        };
      }

      const res = await Circle.updateOne(
        { id: circle.id, actorId: activity.actorId, "members.id": memberId },
        {
          $pull: { members: { id: memberId } },
          $set: { updatedAt: new Date() },
        }
      );

      const removed = res.modifiedCount > 0;

      activity.target = circle.id;
      activity.objectId = memberId;
      activity.sideEffects = { circleId: circle.id, memberId, removed };

      return { activity, circle, removed };
    }

    // ---- Case B: no target → remove from ALL circles owned by the actor ----
    const res = await Circle.updateMany(
      { actorId: activity.actorId, "members.id": memberId },
      { $pull: { members: { id: memberId } }, $set: { updatedAt: new Date() } }
    );

    const removedCount = res.modifiedCount || 0;
    activity.objectId = memberId;
    activity.sideEffects = {
      ownerActorId: activity.actorId,
      memberId,
      removedCount,
    };

    return { activity, removedCount };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
