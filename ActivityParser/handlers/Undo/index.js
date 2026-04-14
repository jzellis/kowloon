// /ActivityParser/handlers/Undo/index.js
// Handle incoming Undo activities from remote servers.
//
// Common cases:
//   - Undo{Follow}: remote actor unfollowed one of our local users
//   - Undo{React}: remote actor removed a reaction
//
// For Undo{Follow} specifically we need to:
//   1. Remove the remote actor from the local user's Followers circle
//   2. No Accept needed

import { Circle, User } from "#schema";
import logger from "#methods/utils/logger.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";

export function validate(activity) {
  if (!activity?.actorId) {
    return { valid: false, errors: ["Undo: missing actorId"] };
  }
  if (!activity?.object) {
    return { valid: false, errors: ["Undo: missing object (the activity being undone)"] };
  }
  return { valid: true };
}

export default async function Undo(activity) {
  try {
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const undoneActivity = typeof activity.object === "object" ? activity.object : null;
    const undoneType = undoneActivity?.type ?? null;

    // --- Undo{Follow}: remote actor unfollows a local user ---
    if (undoneType === "Follow") {
      const remoteActorId = activity.actorId;
      const followedTarget = undoneActivity.object;

      if (!followedTarget) {
        return { activity, result: { status: "no_target" } };
      }

      // Find the local user being unfollowed
      let localUser = await User.findOne({ actorId: followedTarget }).lean();
      if (!localUser) localUser = await User.findOne({ id: followedTarget }).lean();
      if (!localUser) {
        // Not one of our users — ignore
        return { activity, result: { status: "not_local_user" } };
      }

      // Remove from Followers circle
      const circle = await Circle.findOne({ actorId: localUser.id, name: "Followers" }).lean();
      if (circle) {
        const res = await Circle.updateOne(
          { id: circle.id, "members.id": remoteActorId },
          { $pull: { members: { id: remoteActorId } }, $inc: { memberCount: -1 } }
        );
        const removed = !!(res?.modifiedCount > 0);
        logger.info("Undo Follow: removed from Followers circle", { remoteActorId, localUser: localUser.id, removed });
        return {
          activity,
          result: { status: removed ? "unfollowed" : "not_following" },
          federation: { shouldFederate: false },
        };
      }

      return { activity, result: { status: "no_followers_circle" } };
    }

    // --- Undo{Like/React}: not yet implemented ---
    // For now: acknowledge but take no action
    logger.info("Undo: received but not yet handled", { undoneType, actorId: activity.actorId });
    return {
      activity,
      result: { status: "ignored", undoneType },
      federation: { shouldFederate: false },
    };
  } catch (err) {
    return { activity, error: `Undo: ${err.message}` };
  }
}
