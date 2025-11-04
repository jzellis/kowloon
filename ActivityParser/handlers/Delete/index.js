// /ActivityParser/handlers/Delete/index.js

import {
  Bookmark,
  Circle,
  Event,
  Group,
  Page,
  Post,
  React as ReactModel,
  Reply,
  User,
  FeedCache,
} from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";

const MODELS = {
  Bookmark,
  Circle,
  Event,
  Group,
  Page,
  Post,
  React: ReactModel,
  Reply,
  User,
};

// Object types that should be tombstoned in FeedCache
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Event",
  "Page",
  "Bookmark",
  "React",
];

/**
 * Tombstone FeedCache entry when source object is deleted
 */
async function tombstoneFeedCache(deletedId, objectType) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    await FeedCache.findOneAndUpdate(
      { id: deletedId },
      {
        $set: {
          deletedAt: new Date(),
          tombstoned: true,
        },
      }
    );
  } catch (err) {
    console.error(
      `FeedCache tombstone failed for ${deletedId}:`,
      err.message
    );
    // Non-fatal: don't block object deletion if cache tombstone fails
  }
}

export default async function Delete(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Delete: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Delete: missing activity.target" };
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

    // Tombstone FeedCache entry
    await tombstoneFeedCache(deleted.id, parsed.type);

    return { activity, deleted };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
