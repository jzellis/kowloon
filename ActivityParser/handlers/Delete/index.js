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
import isServerAdmin from "#methods/auth/isServerAdmin.js";
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

async function purgeFeedItems(deletedId) {
  try {
    await FeedItems.deleteOne({ id: deletedId });
  } catch (err) {
    console.error(`FeedItems purge failed for ${deletedId}:`, err.message);
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

  // target may be a string or a non-empty array of strings
  const t = activity?.target;
  if (!t) {
    errors.push("Delete: missing required field 'target' (object ID or array of IDs)");
  } else if (Array.isArray(t)) {
    if (t.length === 0) errors.push("Delete: 'target' array must not be empty");
    else if (t.some((id) => typeof id !== "string"))
      errors.push("Delete: all entries in 'target' array must be strings");
  } else if (typeof t !== "string") {
    errors.push("Delete: 'target' must be a string or array of strings");
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

async function deleteOne(activity, targetId) {
  const parsed = kowloonId(targetId);
  const Model = MODELS[parsed?.type];
  if (!Model) {
    return { id: targetId, error: `unsupported target type "${parsed?.type}"` };
  }

  const query =
    parsed.type === "URL" ? { url: targetId } : { id: targetId };

  const current =
    (await Model.findOne(query).lean?.()) ?? (await Model.findOne(query));
  if (!current) {
    return { id: targetId, error: `target not found` };
  }

  const ownerActorId = parsed.type === "User" ? current.id : current.actorId;
  const isOwner = activity.actorId === ownerActorId;
  const isAdmin = await isServerAdmin(activity.actorId);
  if (!isOwner && !isAdmin) {
    return { id: targetId, error: "not authorized to delete this object" };
  }

  const tombstoneFields =
    parsed.type === "User"
      ? { deletedAt: new Date(), deletedBy: activity.actorId, active: false }
      : { deletedAt: new Date(), deletedBy: activity.actorId, type: "Tombstone" };

  const deleted =
    (await Model.findOneAndUpdate(query, { $set: tombstoneFields }, { new: true }).lean?.()) ??
    (await Model.findOneAndUpdate(query, { $set: tombstoneFields }, { new: true }));

  await purgeFeedItems(deleted.id);

  let resultObj = deleted.toObject ? deleted.toObject() : { ...deleted };
  if (parsed.type === "User") {
    delete resultObj.password;
    delete resultObj.privateKey;
    delete resultObj.publicKeyJwk;
    delete resultObj.signature;
  }

  return { id: targetId, deleted: resultObj };
}

export default async function Delete(activity) {
  try {
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const targets = Array.isArray(activity.target)
      ? activity.target
      : [activity.target];

    const results = await Promise.all(targets.map((id) => deleteOne(activity, id)));

    const succeeded = results.filter((r) => r.deleted);
    const failed = results.filter((r) => r.error);

    if (succeeded.length === 0) {
      return { activity, error: failed.map((r) => `${r.id}: ${r.error}`).join("; ") };
    }

    // Use the first successful deletion for federation targeting
    const primary = succeeded[0].deleted;
    activity.objectId = primary.id;
    const federation = await getFederationTargets(activity, primary);

    // Single-target: preserve original response shape for backwards compat
    if (targets.length === 1) {
      return { activity, created: primary, result: primary, federation };
    }

    return {
      activity,
      results: succeeded.map((r) => r.deleted),
      errors: failed.length > 0 ? failed : undefined,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
