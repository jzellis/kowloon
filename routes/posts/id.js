import route from "../utils/route.js";
import { FeedItems, File, Post } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";
import { getStorageAdapter } from "#methods/files/index.js";

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

  // Resolve local file IDs to presigned S3 URLs (1 hour TTL).
  // Remote file: IDs would have been rewritten to HTTP URLs during federation.
  const localFileIds = new Set();
  if (response.image?.startsWith?.("file:")) localFileIds.add(response.image);
  for (const id of response.attachments ?? []) {
    if (id?.startsWith?.("file:")) localFileIds.add(id);
  }

  const presignedMap = new Map(); // fileId → { url, mediaType, name }
  if (localFileIds.size > 0) {
    const storage = await getStorageAdapter();
    const files = await File.find({ id: { $in: [...localFileIds] } })
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

  if (response.image?.startsWith("file:")) {
    response.featuredImage = presignedMap.get(response.image)?.url ?? null;
  } else if (response.image?.startsWith("http")) {
    response.featuredImage = response.image;
  }

  if (response.attachments?.length) {
    response.attachments = response.attachments
      .map((id) => {
        if (!id || typeof id !== "string") return null;
        const entry = presignedMap.get(id);
        if (entry) return entry;
        if (id.startsWith("http")) return { url: id, mediaType: "", name: "" };
        return null;
      })
      .filter(Boolean);
  }

  // Map event dates for all viewers
  if (feedCacheItem.type === 'Event') {
    response.startTime = response.event?.startDate ?? null;
    response.endTime   = response.event?.endDate   ?? null;
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
      response.endTime   = rawPost.event?.endDate   ?? null;
    }
  }

  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }
});
