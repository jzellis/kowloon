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
  "Group",
  "Circle",
];

/**
 * Update FeedCache when source object is updated
 */
async function updateFeedCache(updated, objectType, patchFields) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    // Sanitize object: remove visibility, deletion, source, and MongoDB internal fields
    // These will be stored at FeedCache top-level (visibility) or not at all (internal/metadata)
    const sanitizedObject = { ...updated };
    delete sanitizedObject.to;
    delete sanitizedObject.canReply;
    delete sanitizedObject.canReact;
    delete sanitizedObject.deletedAt;
    delete sanitizedObject.deletedBy;
    delete sanitizedObject.source;
    delete sanitizedObject._id;
    delete sanitizedObject.__v;

    // Build update for FeedCache
    const cacheUpdate = {
      updatedAt: new Date(),
      object: sanitizedObject, // refresh the sanitized object envelope
    };

    // Update subtype if changed
    if (patchFields.type !== undefined) cacheUpdate.type = updated.type;

    // Update top-level visibility fields if changed (with normalization)
    if (patchFields.to !== undefined) {
      const val = String(updated.to || "").toLowerCase().trim();
      cacheUpdate.to = val === "@public" || val === "public" ? "public" : val === "server" ? "server" : "audience";
    }
    if (patchFields.canReply !== undefined) {
      const val = String(updated.canReply || "").toLowerCase().trim();
      cacheUpdate.canReply = ["public", "followers", "audience", "none"].includes(val) ? val : "public";
    }
    if (patchFields.canReact !== undefined) {
      const val = String(updated.canReact || "").toLowerCase().trim();
      cacheUpdate.canReact = ["public", "followers", "audience", "none"].includes(val) ? val : "public";
    }

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
