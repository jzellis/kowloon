// /ActivityParser/handlers/Update/index.js

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

// Object types that should be synced to FeedItems
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Page",
  "Bookmark",
  "Group",
  "Circle",
];

/**
 * Update FeedItems when source object is updated
 */
async function updateFeedItems(updated, objectType, patchFields) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    // Sanitize object: remove visibility, deletion, source, and MongoDB internal fields
    // These will be stored at FeedItems top-level (visibility) or not at all (internal/metadata)
    const sanitizedObject = { ...updated };
    delete sanitizedObject.to;
    delete sanitizedObject.canReply;
    delete sanitizedObject.canReact;
    delete sanitizedObject.deletedAt;
    delete sanitizedObject.deletedBy;
    delete sanitizedObject.source;
    delete sanitizedObject._id;
    delete sanitizedObject.__v;

    // Build update for FeedItems
    const cacheUpdate = {
      updatedAt: new Date(),
      object: sanitizedObject, // refresh the sanitized object envelope
    };

    // Update subtype if changed
    if (patchFields.type !== undefined) cacheUpdate.type = updated.type;

    // Update top-level visibility fields if changed (with normalization)
    if (patchFields.to !== undefined) {
      const val = String(updated.to || "")
        .toLowerCase()
        .trim();
      cacheUpdate.to =
        val === "@public" || val === "public"
          ? "public"
          : val === "server"
          ? "server"
          : "audience";
    }
    if (patchFields.canReply !== undefined) {
      const val = String(updated.canReply || "")
        .toLowerCase()
        .trim();
      cacheUpdate.canReply = [
        "public",
        "followers",
        "audience",
        "none",
      ].includes(val)
        ? val
        : "public";
    }
    if (patchFields.canReact !== undefined) {
      const val = String(updated.canReact || "")
        .toLowerCase()
        .trim();
      cacheUpdate.canReact = [
        "public",
        "followers",
        "audience",
        "none",
      ].includes(val)
        ? val
        : "public";
    }

    await FeedItems.findOneAndUpdate({ id: updated.id }, { $set: cacheUpdate });
  } catch (err) {
    console.error(`FeedItems update failed for ${updated.id}:`, err.message);
    // Non-fatal: don't block object update if cache update fails
  }
}

/**
 * Type-specific validation for Update activities
 * Per specification: object REQUIRED, target REQUIRED (objectType optional, inferred from target)
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  // Required: object (the patch data)
  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("Update: missing required field 'object' (patch data)");
  }

  // Required: target (ID of object to update)
  if (!activity?.target || typeof activity.target !== "string") {
    errors.push("Update: missing required field 'target' (object ID)");
  }

  // Optional: Validate objectType if provided
  if (activity?.objectType) {
    const Model = MODELS[activity.objectType];
    if (!Model) {
      errors.push(`Update: unsupported objectType "${activity.objectType}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Update activity
 * @param {Object} activity - The activity envelope
 * @param {Object} updated - The updated object
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, updated) {
  // Use the common helper based on the updated object's addressing
  return getFederationTargetsHelper(activity, updated);
}

export default async function Update(activity) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
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

    // Apply patch - body regeneration for Post/Reply handled by schema hook
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

    // Update FeedItems to reflect changes
    await updateFeedItems(updated, parsed.type, activity.object);

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, updated);

    return {
      activity,
      created: updated,
      result: updated,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
