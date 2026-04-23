// Shared helper: write or re-write a FeedItems cache entry for a created/restored object.
// Used by ActivityParser/handlers/Create and admin restore routes.

import { FeedItems } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import kowloonId from "#methods/parse/kowloonId.js";

const FEED_CACHEABLE_TYPES = ["Post", "Reply", "Page", "Bookmark", "Group", "Circle"];

function shouldWriteFeedItem(created, objectType) {
  if (!FEED_CACHEABLE_TYPES.includes(objectType)) return false;
  if (objectType === "Post" || objectType === "Reply" || objectType === "Page") return true;
  if (objectType === "Group") return true;
  if (objectType === "Circle" || objectType === "Bookmark") {
    return created.to !== created.actorId;
  }
  return false;
}

export default async function writeFeedItems(created, objectType) {
  try {
    if (!shouldWriteFeedItem(created, objectType)) return;
    if (!created?.id) {
      console.error("FeedItems write skipped: created object missing id", { objectType });
      return;
    }

    const { domain } = getServerSettings();
    const parsed = kowloonId(created.id);
    const isLocal = parsed?.domain?.toLowerCase() === domain?.toLowerCase();

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

    let group;
    if (created.to && typeof created.to === "string") {
      const toValue = created.to.trim();
      if (toValue.startsWith("group:")) group = toValue;
    }

    const cacheEntry = {
      id: created.id,
      url: created.url,
      server: created.server,
      origin: isLocal ? "local" : "remote",
      originDomain: parsed?.domain || domain,
      actorId: created.actorId,
      objectType,
      type: created.type,
      inReplyTo: created.inReplyTo,
      threadRoot: created.threadRoot,
      group,
      object: sanitizedObject,
      to: normalizeTo(created.to),
      canReply: normalizeCap(created.canReply),
      canReact: normalizeCap(created.canReact),
      publishedAt: created.createdAt || created.publishedAt || new Date(),
      updatedAt: created.updatedAt,
    };

    await FeedItems.findOneAndUpdate(
      { id: created.id },
      { $set: cacheEntry },
      { upsert: true, new: true }
    );

    try {
      const { default: enqueueFeedFanOut } = await import("#methods/feed/enqueueFanOut.js");
      await enqueueFeedFanOut({
        feedItemId: created.id,
        objectType,
        actorId: created.actorId,
        audience: {
          to: created.to,
          canReply: created.canReply || "public",
          canReact: created.canReact || "public",
        },
      });
    } catch (err) {
      console.error(`Feed fan-out enqueue failed for ${created.id}:`, err.message);
    }
  } catch (err) {
    console.error(`FeedItems write failed for ${created.id}:`, err.message);
  }
}
