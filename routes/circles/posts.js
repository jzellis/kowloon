// routes/circles/posts.js
// GET /circles/:id/posts — Primary timeline view (circle-based feed)

import route from "../utils/route.js";
import { Circle, File } from "#schema";
import getTimeline from "#methods/feed/getTimeline.js";

const VISIBILITY_MAP = { public: 'Public', server: 'Server', audience: 'Audience' };

function parseUsername(actorId) {
  if (!actorId) return null;
  return actorId.replace(/^@/, '').split('@')[0] || null;
}

/**
 * Normalize a raw FeedItems document into the shape frontend components expect.
 * Flattens post content from item.object to the top level.
 */
function normalizeFeedItem(item) {
  const raw = item.toObject ? item.toObject() : { ...item };
  const obj = raw.object ?? {};
  const actor = (obj.actor && Object.keys(obj.actor).length > 0) ? obj.actor : null;

  return {
    // Spread post content fields (body, title, href, tags, event, attachments, etc.)
    ...obj,

    // Top-level identifiers always win
    id: raw.id,
    url: raw.url ?? obj.url,
    objectType: raw.objectType,
    type: raw.type,

    // Author — map actor/actorId → attributedTo (ActivityStreams convention used by frontend)
    attributedTo: {
      id: raw.actorId,
      name: actor?.name ?? parseUsername(raw.actorId),
      icon: actor?.icon ?? null,
      url: actor?.url ?? null,
      server: actor?.server ?? null,
    },

    // Timestamp
    published: raw.publishedAt,
    publishedAt: raw.publishedAt,

    // Visibility string the frontend expects
    visibility: VISIBILITY_MAP[raw.to] ?? 'Public',

    // Capabilities
    canReply: raw.canReply,
    canReact: raw.canReact,
  };
}

function serveUrl(req, fileId) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/files/${encodeURIComponent(fileId)}`;
}

export default route(async ({ req, params, query, user, set, setStatus }) => {
  const circleId = decodeURIComponent(params.id);

  // Always 404 — never reveal whether a circle exists but is private
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
  const since = query.since || null;
  const limit = Math.min(Number(query.limit) || 50, 500);

  const result = await getTimeline({
    viewerId: user.id,
    circleId,
    types,
    since,
    limit,
  });

  const normalized = result.items.map(normalizeFeedItem);

  // Resolve File IDs in image and attachments fields to {url, mediaType, name} objects
  const fileIds = new Set();
  for (const item of normalized) {
    if (item.image && item.image.startsWith("file:")) fileIds.add(item.image);
    for (const id of item.attachments ?? []) {
      if (id && typeof id === "string" && id.startsWith("file:")) fileIds.add(id);
    }
  }

  const fileMap = new Map();
  if (fileIds.size > 0) {
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id url mediaType name summary")
      .lean();
    for (const f of files) fileMap.set(f.id, f);
  }

  const orderedItems = normalized.map((item) => {
    if (item.image) {
      if (item.image.startsWith("file:") && fileMap.has(item.image)) {
        item.featuredImage = serveUrl(req, item.image);
      } else if (item.image.startsWith("http")) {
        item.featuredImage = item.image;
      }
    }
    if (item.attachments?.length) {
      item.attachments = item.attachments
        .map((id) => {
          if (!id || typeof id !== "string") return null;
          const f = fileMap.get(id);
          if (f) return { url: serveUrl(req, id), mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" };
          if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
          return null;
        })
        .filter(Boolean);
    }
    return item;
  });

  set("@context", "https://www.w3.org/ns/activitystreams");
  set("type", "OrderedCollection");
  set("totalItems", orderedItems.length);
  set("orderedItems", orderedItems);
  if (result.nextCursor) {
    set("next", result.nextCursor);
  }
});
