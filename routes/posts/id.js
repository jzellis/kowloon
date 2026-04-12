import route from "../utils/route.js";
import { FeedItems, File } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

function serveUrl(req, fileId) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/files/${encodeURIComponent(fileId)}`;
}

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params; // e.g. "post:123@domain.com"
  const viewerId = req.user?.id || null;

  const feedCacheItem = await FeedItems.findOne({
    id,
    objectType: "Post",
    deletedAt: null,
    tombstoned: { $ne: true },
  }).lean();

  if (!feedCacheItem) {
    setStatus(404);
    set("error", "Post not found");
    return;
  }

  const followerMap = await buildFollowerMap([feedCacheItem.actorId]);
  const allowed = await canView(feedCacheItem, viewerId, { followerMap });

  if (!allowed) {
    setStatus(viewerId ? 403 : 401);
    set("error", viewerId ? "Access denied" : "Authentication required");
    return;
  }

  const enriched = await enrichWithCapabilities(feedCacheItem, viewerId, { followerMap });

  const response = {
    ...enriched.object,
    canReply: enriched.canReply,
    canReact: enriched.canReact,
    publishedAt: enriched.publishedAt,
    updatedAt: enriched.updatedAt,
  };

  // Resolve file IDs in image and attachments to {url, mediaType, name} objects
  const fileIds = new Set();
  if (response.image && typeof response.image === "string" && response.image.startsWith("file:")) {
    fileIds.add(response.image);
  }
  for (const id of response.attachments ?? []) {
    if (id && typeof id === "string" && id.startsWith("file:")) fileIds.add(id);
  }

  if (fileIds.size > 0) {
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id url mediaType name summary")
      .lean();
    const fileMap = new Map(files.map((f) => [f.id, f]));

    if (response.image && fileMap.has(response.image)) {
      response.featuredImage = serveUrl(req, response.image);
    } else if (typeof response.image === "string" && response.image.startsWith("http")) {
      response.featuredImage = response.image;
    }

    if (response.attachments?.length) {
      response.attachments = response.attachments
        .map((id) => {
          if (!id || typeof id !== "string") return null;
          const f = fileMap.get(id);
          if (f) return { url: serveUrl(req, id), mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" };
          if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
          return null;
        })
        .filter(Boolean);
    }
  }

  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }
});
