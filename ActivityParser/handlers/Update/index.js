// /ActivityParser/handlers/Update/index.js

import bcrypt from "bcryptjs";
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

// Fields each objectType allows to be patched.
// Anything not in the set is silently stripped before the $set.
const ALLOWED_FIELDS = {
  User:     new Set(["profile", "prefs", "to", "canReply", "canReact", "email", "username"]),
  Post:     new Set(["title", "summary", "source", "body", "type", "tags", "to", "canReply", "canReact", "image", "attachments", "href", "target", "location", "event"]),
  Reply:    new Set(["source", "body", "tags"]),
  Page:     new Set(["title", "summary", "source", "body", "slug", "tags", "to", "canReply", "canReact", "image", "attachments", "href", "parentFolder", "order"]),
  Bookmark: new Set(["title", "summary", "type", "tags", "to", "canReply", "canReact", "href", "target"]),
  Circle:   new Set(["name", "description", "to", "canReply", "canReact"]),
  Group:    new Set(["name", "description", "icon", "to", "canReply", "canReact", "rsvpPolicy", "location"]),
  React:    new Set(["emoji", "name"]),
};

// Object types that should be synced to FeedItems
const FEED_CACHEABLE_TYPES = ["Post", "Reply", "Page", "Bookmark", "Group", "Circle"];

/**
 * Strip disallowed fields from patch; return only the allowed subset.
 */
function filterPatch(objectType, patch) {
  const allowed = ALLOWED_FIELDS[objectType];
  if (!allowed) return { ...patch }; // unknown type: pass through (handled by validate)
  return Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.has(k))
  );
}

/**
 * Update FeedItems when source object is updated
 */
async function updateFeedItems(updated, objectType, patchFields) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    const sanitizedObject = { ...updated };
    delete sanitizedObject.to;
    delete sanitizedObject.canReply;
    delete sanitizedObject.canReact;
    delete sanitizedObject.deletedAt;
    delete sanitizedObject.deletedBy;
    delete sanitizedObject.source;
    delete sanitizedObject._id;
    delete sanitizedObject.__v;

    const cacheUpdate = {
      updatedAt: new Date(),
      object: sanitizedObject,
    };

    if (patchFields.type !== undefined) cacheUpdate.type = updated.type;

    if (patchFields.to !== undefined) {
      const val = String(updated.to || "").toLowerCase().trim();
      cacheUpdate.to =
        val === "@public" || val === "public" ? "public"
        : val === "server" ? "server"
        : "audience";
    }
    if (patchFields.canReply !== undefined) {
      const val = String(updated.canReply || "").toLowerCase().trim();
      cacheUpdate.canReply = ["public", "followers", "audience", "none"].includes(val) ? val : "public";
    }
    if (patchFields.canReact !== undefined) {
      const val = String(updated.canReact || "").toLowerCase().trim();
      cacheUpdate.canReact = ["public", "followers", "audience", "none"].includes(val) ? val : "public";
    }

    await FeedItems.findOneAndUpdate({ id: updated.id }, { $set: cacheUpdate });
  } catch (err) {
    console.error(`FeedItems update failed for ${updated.id}:`, err.message);
  }
}

/**
 * Type-specific validation for Update activities
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("Update: missing required field 'object' (patch data)");
  }

  if (!activity?.target || typeof activity.target !== "string") {
    errors.push("Update: missing required field 'target' (object ID)");
  }

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

export async function getFederationTargets(activity, updated) {
  return getFederationTargetsHelper(activity, updated);
}

export default async function Update(activity) {
  try {
    // 1. Validate shape
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    // 2. Resolve model from target ID
    const parsed = kowloonId(activity.target);
    const Model = MODELS[parsed?.type];
    if (!Model) {
      return { activity, error: `Update: unsupported target type "${parsed?.type}"` };
    }

    const query =
      parsed.type === "URL" ? { url: activity.target } : { id: activity.target };

    const current =
      (await Model.findOne(query).lean?.()) ?? (await Model.findOne(query));
    if (!current) {
      return { activity, error: `Update: target not found: ${activity.target}` };
    }

    // 3. Authorization
    // For User objects, the "owner" is the user themselves (current.id).
    // For everything else, the "owner" is the actorId field.
    const ownerActorId =
      parsed.type === "User" ? current.id : current.actorId;

    const isOwner = activity.actorId === ownerActorId;
    const isAdmin = await isServerAdmin(activity.actorId);

    if (!isOwner && !isAdmin) {
      return { activity, error: "Update: not authorized to modify this object" };
    }

    // 4. Strip disallowed fields from the patch
    const patch = filterPatch(parsed.type, activity.object);

    // 5. Password change — handled separately; cannot be done by admins on behalf of users
    if (parsed.type === "User" && "password" in activity.object) {
      const pwChange = activity.object.password;

      if (!isOwner) {
        return { activity, error: "Update: only the account owner can change their password" };
      }
      if (!pwChange?.current || !pwChange?.new) {
        return { activity, error: "Update: password change requires { current, new }" };
      }
      if (typeof pwChange.new !== "string" || pwChange.new.length < 8) {
        return { activity, error: "Update: new password must be at least 8 characters" };
      }

      const valid = await bcrypt.compare(pwChange.current, current.password);
      if (!valid) {
        return { activity, error: "Update: current password is incorrect" };
      }

      const hashed = await bcrypt.hash(pwChange.new, 12);
      await User.updateOne({ id: current.id }, { $set: { password: hashed } });
    }

    // Remove password from the regular $set patch regardless
    delete patch.password;

    // If nothing left to patch (e.g. only password was sent), return early
    if (Object.keys(patch).length === 0 && !("password" in activity.object)) {
      return { activity, error: "Update: no updatable fields provided" };
    }

    // 6. Apply patch (skip if nothing left after password-only update)
    let updated = current;
    if (Object.keys(patch).length > 0) {
      updated =
        (await Model.findOneAndUpdate(query, { $set: patch }, { new: true, runValidators: true }).lean?.()) ??
        (await Model.findOneAndUpdate(query, { $set: patch }, { new: true, runValidators: true }));

      if (!updated) {
        return { activity, error: `Update: failed to update ${activity.target}` };
      }
    }

    activity.objectId = updated.id ?? activity.target;
    activity.object = patch; // normalise to the filtered patch for downstream

    // 7. Sync FeedItems cache
    await updateFeedItems(updated, parsed.type, patch);

    // 8. Federation
    const federation = await getFederationTargets(activity, updated);

    // 9. Sanitize result — strip sensitive fields from User objects
    let resultObj = updated.toObject ? updated.toObject() : { ...updated };
    if (parsed.type === "User") {
      delete resultObj.password;
      delete resultObj.privateKey;
      delete resultObj.publicKeyJwk;
      delete resultObj.signature;
    }

    return { activity, created: resultObj, result: resultObj, federation };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
