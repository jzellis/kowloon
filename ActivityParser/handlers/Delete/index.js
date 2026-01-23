// /ActivityParser/handlers/Delete/index.js

import {
  Bookmark,
  Circle,
  Group,
  Page,
  Post,
  React as ReactModel,
  Reply,
  User,
  FeedItems,
} from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";

const MODELS = {
  Bookmark,
  Circle,
  Group,
  Page,
  Post,
  React: ReactModel,
  Reply,
  User,
};

// Object types that should be tombstoned in FeedItems
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Page",
  "Bookmark",
  "React",
  "Group",
  "Circle",
];

/**
 * Tombstone FeedItems entry when source object is deleted
 */
async function tombstoneFeedItems(deletedId, objectType) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    await FeedItems.findOneAndUpdate(
      { id: deletedId },
      {
        $set: {
          deletedAt: new Date(),
          tombstoned: true,
        },
      }
    );
  } catch (err) {
    console.error(`FeedItems tombstone failed for ${deletedId}:`, err.message);
    // Non-fatal: don't block object deletion if cache tombstone fails
  }
}

/**
 * Type-specific validation for Delete activities
 * Per specification: target REQUIRED (all other fields optional)
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Delete: missing activity.actorId");
  }

  // Required: target (ID of object to delete)
  if (!activity?.target || typeof activity.target !== "string") {
    errors.push("Delete: missing required field 'target' (object ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Delete activity
 * @param {Object} activity - The activity envelope
 * @param {Object} deleted - The deleted object
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, deleted) {
  // Use the common helper based on the deleted object's addressing
  return getFederationTargetsHelper(activity, deleted);
}

export default async function Delete(activity) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const parsed = kowloonId(activity.target);
    const Model = MODELS[parsed?.type];
    if (!Model) {
      return {
        activity,
        error: `Delete: unsupported target type "${parsed?.type}"`,
      };
    }

    const query =
      parsed.type === "URL"
        ? { url: activity.target }
        : { id: activity.target };

    const deleted =
      (await Model.findOneAndUpdate(
        query,
        { $set: { deletedAt: new Date(), deletedBy: activity.actorId } },
        { new: true }
      ).lean?.()) ??
      (await Model.findOneAndUpdate(
        query,
        { $set: { deletedAt: new Date(), deletedBy: activity.actorId } },
        { new: true }
      ));

    if (!deleted) {
      return {
        activity,
        error: `Delete: target not found: ${activity.target}`,
      };
    }

    // annotate for downstreams + Undo
    activity.objectId = deleted.id;

    // Tombstone FeedItems entry
    await tombstoneFeedItems(deleted.id, parsed.type);

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, deleted);

    return {
      activity,
      created: deleted,
      result: deleted,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
