// /ActivityParser/handlers/Create/index.js

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
  Settings,
  FeedCache, // <- ensure Settings is exported from #schema/index.js
} from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
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

// Object types that should be cached in FeedCache for timeline delivery
const FEED_CACHEABLE_TYPES = [
  "Post",
  "Reply",
  "Event",
  "Page",
  "Bookmark",
  "React",
];

/**
 * Write created object to FeedCache for timeline delivery and enqueue fan-out
 */
async function writeFeedCache(created, objectType) {
  try {
    if (!FEED_CACHEABLE_TYPES.includes(objectType)) return;

    const { domain } = getServerSettings();
    const parsed = kowloonId(created.id);
    const isLocal = parsed?.domain?.toLowerCase() === domain?.toLowerCase();

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
      object: created, // normalized content envelope
      to: created.to || "public",
      canReply: created.canReply || "public",
      canReact: created.canReact || "public",
      publishedAt: created.createdAt || created.publishedAt || new Date(),
      updatedAt: created.updatedAt,
    };

    await FeedCache.findOneAndUpdate(
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
      console.error(`Feed fan-out enqueue failed for ${created.id}:`, err.message);
      // Non-fatal: worker can retry or admin can manually trigger
    }
  } catch (err) {
    console.error(`FeedCache write failed for ${created.id}:`, err.message);
    // Non-fatal: don't block object creation if cache write fails
  }
}

export default async function Create(activity) {
  try {
    const type = activity?.objectType;
    if (!type || typeof type !== "string") {
      return { activity, error: "Create: missing activity.objectType" };
    }

    const Model = MODELS[type];
    if (!Model) {
      return { activity, error: `Create: unsupported objectType "${type}"` };
    }

    if (!activity?.object || typeof activity.object !== "object") {
      return { activity, error: "Create: missing activity.object" };
    }

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

      // Users typically don't go into FeedCache (not timeline objects)
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
    const created = await Model.create(activity.object);

    activity.objectId = created.id;

    // Write to FeedCache for timeline delivery
    await writeFeedCache(created, type);

    return { activity, created };
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
