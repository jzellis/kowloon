// routes/circles/posts.js
// GET /circles/:id/posts — Primary timeline view (circle-based feed)

import route from "../utils/route.js";
import { Circle, File } from "#schema";
import getTimeline from "#methods/feed/getTimeline.js";
import { getSetting } from "#methods/settings/cache.js";
import { buildFileUrl } from "#methods/files/signedUrl.js";
import { fileIdFromValue } from "#methods/files/fileRef.js";

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

  // A circle's feed is viewable by anyone allowed to see the circle — not just
  // its owner. getTimeline is viewer-scoped (FeedFanOut only surfaces posts the
  // viewer may see), so a public circle previews safely: you see its members'
  // posts that are visible to you.
  const circle = await Circle.findOne({ id: circleId, deletedAt: null })
    .select("actorId to members")
    .lean();

  if (!circle) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  const domain = getSetting("domain");
  const to = circle.to || "";
  const isPublic = to === "@public" || to === "public";
  const isServerVisible =
    to === `@${domain}` || to === "@server" || to === "server";
  const isOwner = !!user?.id && circle.actorId === user.id;
  const isMember = !!user?.id && circle.members?.some((m) => m.id === user.id);

  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return;
  }
  if (!isPublic && !isServerVisible && !isOwner && !isMember) {
    setStatus(403);
    set("error", "Access denied");
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
  const restrictedFiles = new Set();
  for (const item of normalized) {
    const restricted = item.visibility !== "Public";
    const add = (id) => {
      const fid = fileIdFromValue(id);
      if (!fid) return;
      fileIds.add(fid);
      if (restricted) restrictedFiles.add(fid);
    };
    add(item.image);
    for (const id of item.attachments ?? []) add(id);
  }

  // Resolve local file IDs to app-served URLs (GET /files/:id). Public files get
  // a plain, cacheable URL; restricted files get a short-lived signed URL so
  // authorized <img> loads work without a token.
  const presignedMap = new Map(); // fileId → { url, mediaType, name }
  if (fileIds.size > 0) {
    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id mediaType name summary updatedAt")
      .lean();
    for (const f of files) {
      presignedMap.set(f.id, {
        url: buildFileUrl({ fileId: f.id, domain, protocol, restricted: restrictedFiles.has(f.id), version: f.updatedAt ? new Date(f.updatedAt).getTime() : undefined }),
        mediaType: f.mediaType ?? "",
        name: f.name ?? f.summary ?? "",
      });
    }
  }

  const orderedItems = normalized.map((item) => {
    const imgFid = fileIdFromValue(item.image);
    if (imgFid) {
      item.featuredImage = presignedMap.get(imgFid)?.url ?? null;
    } else if (item.image?.startsWith("http")) {
      item.featuredImage = item.image;
    }

    if (item.attachments?.length) {
      item.attachments = item.attachments
        .map((id) => {
          if (!id || typeof id !== "string") return null;
          const entry = presignedMap.get(fileIdFromValue(id));
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
