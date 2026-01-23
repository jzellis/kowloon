// /methods/inbox/checkBlocked.js
// Check if an incoming actor is blocked by the target or recipient

import { Circle } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import logger from "#methods/utils/logger.js";

/**
 * Check if actorId is blocked by any relevant entities in the activity
 * @param {Object} activity - The activity to check
 * @param {string} activity.actorId - The actor performing the action
 * @param {string} activity.to - The recipient of the activity
 * @param {string} activity.target - The target object of the activity
 * @returns {Promise<boolean>} true if blocked, false if not blocked
 */
export default async function checkBlocked(activity) {
  if (!activity?.actorId) {
    return false; // Can't check without actorId
  }

  try {
    // Fetch the recipient and target objects
    const [to, target] = await Promise.all([
      activity.to ? getObjectById(activity.to) : null,
      activity.target ? getObjectById(activity.target) : null,
    ]);

    // Get the target's actor if it exists
    const targetActor = target?.actorId
      ? await getObjectById(target.actorId)
      : null;

    // Collect all potential "blocked" circle IDs
    const blockedCircleIds = [
      to?.blocked,
      target?.blocked,
      targetActor?.blocked,
    ].filter(Boolean);

    if (blockedCircleIds.length === 0) {
      return false; // No block lists to check
    }

    // Query all blocked circles and extract member IDs
    const blockedCircles = await Circle.find({
      id: { $in: blockedCircleIds },
    }).lean();

    const blockedActorIds = blockedCircles
      .flatMap((circle) => (circle.members || []).map((m) => m.id))
      .filter(Boolean);

    // Check if the incoming actor is in any blocked list
    const isBlocked = blockedActorIds.includes(activity.actorId);

    if (isBlocked) {
      logger.info("Blocked actor detected", {
        actorId: activity.actorId,
        type: activity.type,
        to: activity.to,
        target: activity.target,
      });
    }

    return isBlocked;
  } catch (error) {
    logger.error("Error checking blocked status", {
      actorId: activity.actorId,
      error: error.message,
    });
    // Fail open - don't block on errors (could add stricter policy here)
    return false;
  }
}
