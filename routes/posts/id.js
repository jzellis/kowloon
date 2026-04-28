import route from "../utils/route.js";
import { FeedItems, File, Post } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";
import { getSetting } from "#methods/settings/cache.js";

function serveUrl(req, fileId, token, localDomain) {
  const fileDomain = fileId?.includes("@") ? fileId.slice(fileId.lastIndexOf("@") + 1) : null;
  if (fileDomain && localDomain && fileDomain.toLowerCase() !== localDomain.toLowerCase()) {
    return `https://${fileDomain}/files/${encodeURIComponent(fileId)}`;
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = `${proto}://${host}/files/${encodeURIComponent(fileId)}`;
  return token ? `${base}?token=${token}` : base;
}

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params; // e.g. "post:123@domain.com"
  const viewerId = req.user?.id || null;
  const viewerToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const localDomain = getSetting("domain");

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

  // Resolve file IDs in image and attachments to {url, mediaType, name} objects.
  // Fetch local File records for metadata (mediaType, name); remote file: IDs get
  // routed to their origin server's proxy without a DB lookup.
  const localFileIds = new Set();
  if (response.image?.startsWith?.("file:")) localFileIds.add(response.image);
  for (const id of response.attachments ?? []) {
    if (id?.startsWith?.("file:")) localFileIds.add(id);
  }

  const files = localFileIds.size > 0
    ? await File.find({ id: { $in: [...localFileIds] } }).select("id url mediaType name summary").lean()
    : [];
  const fileMap = new Map(files.map((f) => [f.id, f]));

  if (response.image) {
    if (response.image.startsWith("file:")) {
      response.featuredImage = serveUrl(req, response.image, viewerToken, localDomain);
    } else if (response.image.startsWith("http")) {
      response.featuredImage = response.image;
    }
  }

  if (response.attachments?.length) {
    response.attachments = response.attachments
      .map((id) => {
        if (!id || typeof id !== "string") return null;
        const f = fileMap.get(id);
        if (f) return { url: serveUrl(req, id, viewerToken, localDomain), mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" };
        if (id.startsWith("file:")) return { url: serveUrl(req, id, viewerToken, localDomain), mediaType: "", name: "" };
        if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
        return null;
      })
      .filter(Boolean);
  }

  // For the owner, include raw editable fields from the Post model
  if (viewerId && viewerId === feedCacheItem.actorId) {
    const rawPost = await Post.findOne({ id: feedCacheItem.id })
      .select("source title href to canReply canReact tags location event")
      .lean();
    if (rawPost) {
      response.source = rawPost.source ?? null;
      response.title = rawPost.title ?? null;
      response.href = rawPost.href ?? null;
      response.to = rawPost.to ?? null;
      response.tags = rawPost.tags ?? [];
      response.location = rawPost.location ?? null;
      response.startTime = rawPost.event?.startDate ?? null;
      response.endTime = rawPost.event?.endDate ?? null;
    }
  }

  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }
});
