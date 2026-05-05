// routes/circles/posts.js
// GET /circles/:id/posts — Primary timeline view (circle-based feed)

import route from "../utils/route.js";
import { Circle, File } from "#schema";
import getTimeline from "#methods/feed/getTimeline.js";
import { getSetting } from "#methods/settings/cache.js";
import { getStorageAdapter } from "#methods/files/index.js";

const VISIBILITY_MAP = { public: 'Public', server: 'Server', audience: 'Audience' };

function parseUsername(actorId) {
  if (!actorId) return null;
  return actorId.replace(/^@/, '').split('@')[0] || null;
}

function normalizeFeedItem(item) {
  const raw = item.toObject ? item.toObject() : { ...item };
  const obj = raw.object ?? {};
  const actor = (obj.actor && Object.keys(obj.actor).length > 0) ? obj.actor : null;

  return {
    ...obj,
    id: raw.id,
    url: raw.url ?? obj.url,
    objectType: raw.objectType,
    type: raw.type,
    attributedTo: {
      id: raw.actorId,
      name: actor?.name ?? parseUsername(raw.actorId),
      icon: actor?.icon ?? null,
      url: actor?.url ?? null,
      server: actor?.server ?? null,
    },
    published: raw.publishedAt,
    publishedAt: raw.publishedAt,
    visibility: VISIBILITY_MAP[raw.to] ?? 'Public',
    canReply: raw.canReply,
    canReact: raw.canReact,
    startTime: raw.type === 'Event' ? (obj.event?.startDate ?? null) : undefined,
    endTime:   raw.type === 'Event' ? (obj.event?.endDate   ?? null) : undefined,
  };
}

export default route(async ({ req, params, query, user, set, setStatus }) => {
  const circleId = decodeURIComponent(params.id);

  const circle = user?.id
    ? await Circle.findOne({ id: circleId, actorId: user.id, deletedAt: null })
        .select("actorId")
        .lean()
    : null;

  if (!circle) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  const types = query.types
    ? String(query.types).split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const before = query.before || null;
  const limit = Math.min(Number(query.limit) || 50, 500);

  const result = await getTimeline({ viewerId: user.id, circleId, types, before, limit });
  const normalized = result.items.map(normalizeFeedItem);

  // Collect local file IDs from image and attachments fields
  const fileIds = new Set();
  for (const item of normalized) {
    if (item.image?.startsWith("file:")) fileIds.add(item.image);
    for (const id of item.attachments ?? []) {
      if (id && typeof id === "string" && id.startsWith("file:")) fileIds.add(id);
    }
  }

  // Generate presigned URLs for all local files in one pass
  const presignedMap = new Map(); // fileId → { url, mediaType, name }
  if (fileIds.size > 0) {
    const storage = await getStorageAdapter();
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id storageKey mediaType name summary")
      .lean();
    await Promise.all(files.map(async (f) => {
      if (!f.storageKey) return;
      try {
        const url = await storage.getSignedUrl(f.storageKey, 3600);
        presignedMap.set(f.id, { url, mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" });
      } catch { /* non-fatal */ }
    }));
  }

  const orderedItems = normalized.map((item) => {
    if (item.image?.startsWith("file:")) {
      item.featuredImage = presignedMap.get(item.image)?.url ?? null;
    } else if (item.image?.startsWith("http")) {
      item.featuredImage = item.image;
    }

    if (item.attachments?.length) {
      item.attachments = item.attachments
        .map((id) => {
          if (!id || typeof id !== "string") return null;
          const entry = presignedMap.get(id);
          if (entry) return entry;
          if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
          return null;
        })
        .filter(Boolean);
    }
    return item;
  });

  set("@context", "https://www.w3.org/ns/activitystreams");
  set("type", "OrderedCollectionPage");
  set("totalItems", result.total);
  set("orderedItems", orderedItems);
  if (result.nextCursor) set("nextCursor", result.nextCursor);
});
