// /ActivityParser/handlers/Create/index.js

import {
  Bookmark,
  Circle,
  Group,
  Page,
  Post,
  React as ReactModel,
  Reply,
  User,
  Settings,
  FeedItems, // <- ensure Settings is exported from #schema/index.js
} from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import kowloonId from "#methods/parse/kowloonId.js";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";
import createNotification from "#methods/notifications/create.js";

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

// Object types that should be cached in FeedItems for timeline delivery
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Page",
  "Bookmark",
  "Group",
  "Circle",
];

/**
 * Determine if object should be written to FeedItems
 * Rules:
 * - Posts: Always (including private ones)
 * - Circles/Bookmarks: Only if NOT self-addressed (to !== actorId)
 * - Groups: Always
 * - React: Never
 * - Other types: Never
 */
function shouldWriteFeedItem(created, objectType) {
  if (!FEED_CACHEABLE_TYPES.includes(objectType)) return false;

  // Posts always create FeedItems
  if (objectType === 'Post' || objectType === 'Reply' || objectType === 'Page') {
    return true;
  }

  // Groups always create FeedItems
  if (objectType === 'Group') {
    return true;
  }

  // Circles and Bookmarks: only if NOT self-addressed
  if (objectType === 'Circle' || objectType === 'Bookmark') {
    const isPrivate = created.to === created.actorId;
    return !isPrivate;
  }

  return false;
}

/**
 * Write created object to FeedItems for timeline delivery and enqueue fan-out
 */
async function writeFeedItems(created, objectType) {
  try {
    if (!shouldWriteFeedItem(created, objectType)) return;

    if (!created || !created.id) {
      console.error(`FeedItems write skipped: created object missing id`, {
        objectType,
        created,
      });
      return;
    }

    const { domain } = getServerSettings();
    const parsed = kowloonId(created.id);
    const isLocal = parsed?.domain?.toLowerCase() === domain?.toLowerCase();

    // Normalize visibility values from source object format to FeedItems enum format
    // Source objects use "@public" but FeedItems uses "public"
    const normalizeTo = (val) => {
      if (!val) return "public";
      const v = String(val).toLowerCase().trim();
      if (v === "@public" || v === "public") return "public";
      if (v === `@${domain}` || v === "server") return "server";
      return "audience";
    };

    const normalizeCap = (val) => {
      if (!val) return "public";
      const v = String(val).toLowerCase().trim();
      if (v === "@public" || v === "public") return "public";
      if (v === "followers") return "followers";
      if (v === "audience") return "audience";
      if (v === "none") return "none";
      return "public";
    };

    // Sanitize object: remove visibility, deletion, source, and MongoDB internal fields
    // These will be stored at FeedItems top-level (visibility) or not at all (internal/metadata)
    const sanitizedObject = { ...created };
    delete sanitizedObject.to;
    delete sanitizedObject.password;
    delete sanitizedObject.prefs;
    delete sanitizedObject.privateKey;
    delete sanitizedObject.canReply;
    delete sanitizedObject.canReact;
    delete sanitizedObject.deletedAt;
    delete sanitizedObject.deletedBy;
    delete sanitizedObject.source;
    delete sanitizedObject._id;
    delete sanitizedObject.__v;

    // Extract group from 'to' field if it's an ID (not @public/@server)
    // Groups are public containers, so we can store their IDs in FeedItems
    let group = undefined;

    if (created.to && typeof created.to === 'string') {
      const toValue = created.to.trim();
      if (toValue.startsWith('group:')) {
        group = toValue;
      }
    }

    const cacheEntry = {
      id: created.id,
      url: created.url,
      server: created.server,
      origin: isLocal ? "local" : "remote",
      originDomain: parsed?.domain || domain,
      actorId: created.actorId,
      objectType: objectType,
      type: created.type, // subtype (Note/Article/Media/etc)
      inReplyTo: created.inReplyTo,
      threadRoot: created.threadRoot,
      group, // Group ID if addressed to a group (public container)
      object: sanitizedObject, // sanitized content envelope (no visibility/deletion/source)
      to: normalizeTo(created.to), // top-level coarse visibility
      canReply: normalizeCap(created.canReply), // top-level coarse capability
      canReact: normalizeCap(created.canReact), // top-level coarse capability
      publishedAt: created.createdAt || created.publishedAt || new Date(),
      updatedAt: created.updatedAt,
    };

    console.log(`FeedItems write for ${created.id}:`, {
      id: cacheEntry.id,
      actorId: cacheEntry.actorId,
      objectType: cacheEntry.objectType,
      type: cacheEntry.type,
      to: cacheEntry.to,
      group: cacheEntry.group,
    });

    await FeedItems.findOneAndUpdate(
      { id: created.id },
      { $set: cacheEntry },
      { upsert: true, new: true }
    );

    // Enqueue fan-out job (async processing)
    try {
      const { default: enqueueFeedFanOut } = await import(
        "#methods/feed/enqueueFanOut.js"
      );
      await enqueueFeedFanOut({
        feedCacheId: created.id,
        objectType,
        actorId: created.actorId,
        audience: {
          to: cacheEntry.to,
          canReply: cacheEntry.canReply,
          canReact: cacheEntry.canReact,
        },
      });
    } catch (err) {
      console.error(
        `Feed fan-out enqueue failed for ${created.id}:`,
        err.message
      );
      // Non-fatal: worker can retry or admin can manually trigger
    }
  } catch (err) {
    console.error(`FeedItems write failed for ${created.id}:`, err.message);
    // Non-fatal: don't block object creation if cache write fails
  }
}

/**
 * Create notifications for relevant activities
 * - Reply: Notify the author of the post being replied to
 * - Post with mentions: Notify mentioned users (TBD)
 */
async function createNotifications(activity, created, objectType) {
  try {
    // Only create notifications for Post/Reply types
    if (objectType !== "Post") return;

    // Check if this is a Reply (has inReplyTo)
    if (created.inReplyTo) {
      // This is a reply - notify the author of the original post
      const originalPost = await Post.findOne({ id: created.inReplyTo }).lean();

      if (originalPost && originalPost.actorId) {
        await createNotification({
          type: "reply",
          recipientId: originalPost.actorId,
          actorId: activity.actorId,
          objectId: created.id,
          objectType: "Reply",
          activityId: activity.id,
          activityType: "Create",
          groupKey: `reply:${originalPost.id}`,
        });
      }
    }

    // TODO: Check for mentions in content and notify mentioned users

  } catch (err) {
    console.error("Failed to create notifications for Create activity:", err.message);
    // Non-fatal: don't block object creation if notification fails
  }
}

/**
 * Type-specific validation for Create activities
 * Per specification: objectType, object, to, canReply, canReact are REQUIRED
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  // Required: objectType
  const type = activity?.objectType;
  if (!type || typeof type !== "string") {
    errors.push("Create: missing required field 'objectType'");
  }

  if (type && !MODELS[type]) {
    errors.push(`Create: unsupported objectType "${type}"`);
  }

  // Required: object
  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("Create: missing required field 'object'");
  }

  // Required: to
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("Create: missing required field 'to'");
  }

  // Required: canReply
  if (activity?.canReply === undefined) {
    errors.push("Create: missing required field 'canReply'");
  }

  // Required: canReact
  if (activity?.canReact === undefined) {
    errors.push("Create: missing required field 'canReact'");
  }

  // Additional validation for User creation
  if (type === "User") {
    const obj = activity.object;
    const hasPassword = obj?.password || obj?.pass;
    if (!hasPassword) {
      errors.push("Create User: password is required");
    }

    const username = obj?.username;
    const actorIdFromObject = obj?.actorId || obj?.id;
    if (!username && !actorIdFromObject) {
      errors.push("Create User: username or actorId is required");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Create activity
 * @param {Object} activity - The activity envelope
 * @param {Object} created - The created object
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, created) {
  // Users don't federate via Create (they're discovered via webfinger)
  if (activity.objectType === "User") {
    return { shouldFederate: false };
  }

  // Use the common helper based on the created object's addressing
  return getFederationTargetsHelper(activity, created);
}

export default async function Create(activity) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const type = activity.objectType;
    const Model = MODELS[type];

    // ---- Special handling for Create → User --------------------------------
    if (type === "User") {
      const obj = { ...activity.object };

      // Accept either password or legacy "pass" field; normalize to "password"
      if (obj.pass && !obj.password) obj.password = obj.pass;
      delete obj.pass;

      // We need a username. If actorId is present, derive username from it.
      let username = obj.username;
      let actorIdFromObject = obj.actorId || obj.id; // activity requires object.actorId, but model uses "id"
      if (
        !username &&
        actorIdFromObject &&
        typeof actorIdFromObject === "string"
      ) {
        // supports "@user@domain" and plain "user@domain"
        const handle = actorIdFromObject.startsWith("@")
          ? actorIdFromObject.slice(1)
          : actorIdFromObject;
        username = handle.split("@")[0];
      }

      if (!username || typeof username !== "string") {
        return {
          activity,
          error:
            "Create User: 'username' (or object.actorId with username) is required",
        };
      }

      // Ensure the model "id" field (actor handle) is set consistently
      // If object.actorId is provided, prefer it; otherwise mint from settings.domain
      let actorId = actorIdFromObject;
      if (!actorId) {
        const domainSetting = await Settings.findOne({ name: "domain" }).lean();
        const domain = domainSetting?.value;
        if (!domain) {
          return {
            activity,
            error: "Create User: cannot mint actorId (missing Settings.domain)",
          };
        }
        actorId = `@${username}@${domain}`;
      }
      // Map to schema field "id" (User schema treats `id` as the actor handle)
      obj.id = actorId;

      // The rest (inbox/outbox/url/server/keys) is handled by UserSchema.pre('save')
      const created = await User.create(obj);

      activity.objectId = created.id;

      // Users typically don't go into FeedItems (not timeline objects)
      // but you could add them if needed

      return { activity, created };
    } else {
      // For everything but User, we need to ensure object.actor is present
      if (activity.object.actorId && !activity.object.actor)
        activity.object.actor = activity.actor || {};
    }

    // ---- Generic path for other object types -------------------------------
    // If object.actorId is missing, many models will tolerate it, but your
    // outbox added a fallback already. We leave it as-is here.
    let created = await Model.create(activity.object);

    activity.objectId = created.id;

    // Reload the document to ensure all pre-save hook fields are populated
    // (especially id, url, server which are computed in pre-save)
    // Convert to plain object to access all fields including virtuals
    created = created.toObject ? created.toObject() : created;

    // Write to FeedItems for timeline delivery
    await writeFeedItems(created, type);

    // Create notifications for relevant activities
    await createNotifications(activity, created, type);

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, created);

    return {
      activity,
      created,
      result: created,
      federation,
    };
  } catch (err) {
    // Surface useful info for E11000 etc.
    const payload = {
      message: err?.message || String(err),
    };
    if (err?.code) payload.code = err.code;
    if (err?.keyValue) payload.keyValue = err.keyValue;

    return { activity, error: payload.message, result: payload };
  }
}
