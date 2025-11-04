// /ActivityParser/handlers/Update/index.js

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

// Object types that should be synced to FeedCache
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Event",
  "Page",
  "Bookmark",
  "React",
];

/**
 * Update FeedCache when source object is updated
 */
async function updateFeedCache(updated, objectType, patchFields) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    // Build update for FeedCache
    const cacheUpdate = {
      updatedAt: new Date(),
      object: updated, // refresh the full object envelope
    };

    // Update specific fields that might have changed
    if (patchFields.to !== undefined) cacheUpdate.to = updated.to;
    if (patchFields.canReply !== undefined)
      cacheUpdate.canReply = updated.canReply;
    if (patchFields.canReact !== undefined)
      cacheUpdate.canReact = updated.canReact;
    if (patchFields.type !== undefined) cacheUpdate.type = updated.type;

    await FeedCache.findOneAndUpdate({ id: updated.id }, { $set: cacheUpdate });
  } catch (err) {
    console.error(`FeedCache update failed for ${updated.id}:`, err.message);
    // Non-fatal: don't block object update if cache update fails
  }
}

export default async function Update(activity) {
  try {
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Update: missing activity.target" };
    }
    if (!activity?.object || typeof activity.object !== "object") {
      return { activity, error: "Update: missing activity.object (patch)" };
    }

    // Determine model from the target id
    const parsed = kowloonId(activity.target); // { type, domain, ... } or { type:"URL" }
    const Model = MODELS[parsed?.type];
    if (!Model) {
      return {
        activity,
        error: `Update: unsupported target type "${parsed?.type}"`,
      };
    }

    // Build query by canonical id (or url if you ever allow URL targets)
    const query =
      parsed.type === "URL"
        ? { url: activity.target }
        : { id: activity.target };

    // Fetch current to capture "previous" values for Undo (only keys being patched)
    const current =
      (await Model.findOne(query).lean?.()) ?? (await Model.findOne(query));
    if (!current) {
      return {
        activity,
        error: `Update: target not found: ${activity.target}`,
      };
    }

    // Pick previous values for fields being updated (shallow)
    const previous = {};
    for (const k of Object.keys(activity.object)) {
      // only record primitive/object shallowly--this is a simple, safe snapshot
      previous[k] = current?.[k];
    }

    // Apply patch
    const updated =
      (await Model.findOneAndUpdate(
        query,
        { $set: activity.object },
        { new: true, runValidators: true }
      ).lean?.()) ??
      (await Model.findOneAndUpdate(
        query,
        { $set: activity.object },
        { new: true, runValidators: true }
      ));

    if (!updated) {
      return { activity, error: `Update: failed to update ${activity.target}` };
    }

    // annotate for downstreams + (optional) Undo
    activity.objectId = updated.id;

    // Update FeedCache to reflect changes
    await updateFeedCache(updated, parsed.type, activity.object);

    return { activity, updated };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
