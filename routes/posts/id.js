import route from "../utils/route.js";
import { FeedItems, File, Post, React as ReactModel } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";
import { buildFileUrl, isPublicVisibility } from "#methods/files/signedUrl.js";
import { fileIdFromValue } from "#methods/files/fileRef.js";
import { getSetting } from "#methods/settings/cache.js";

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

  // Resolve local file IDs to app-served URLs (GET /files/:id). Remote file:
  // IDs would have been rewritten to HTTP URLs during federation.
  const localFileIds = new Set();
  const imgFid0 = fileIdFromValue(response.image);
  if (imgFid0) localFileIds.add(imgFid0);
  for (const id of response.attachments ?? []) {
    const fid = fileIdFromValue(id);
    if (fid) localFileIds.add(fid);
  }

  const presignedMap = new Map(); // fileId → { url, mediaType, name }
  if (localFileIds.size > 0) {
    // All of a post's files inherit the post's visibility. Public → plain,
    // cacheable URL; restricted → short-lived signed URL for authorized <img>.
    const restricted = !isPublicVisibility(response.to ?? feedCacheItem.to);
    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const files = await File.find({ id: { $in: [...localFileIds] } })
      .select("id mediaType name summary")
      .lean();
    for (const f of files) {
      presignedMap.set(f.id, {
        url: buildFileUrl({ fileId: f.id, domain, protocol, restricted }),
        mediaType: f.mediaType ?? "",
        name: f.name ?? f.summary ?? "",
      });
    }
  }

  const imgFid = fileIdFromValue(response.image);
  if (imgFid) {
    response.featuredImage = presignedMap.get(imgFid)?.url ?? null;
  } else if (response.image?.startsWith("http")) {
    response.featuredImage = response.image;
  }

  if (response.attachments?.length) {
    response.attachments = response.attachments
      .map((id) => {
        if (!id || typeof id !== "string") return null;
        const fid = fileIdFromValue(id);
        const entry = presignedMap.get(fid);
        // Include the source file ID so the owner's edit screen can preserve
        // existing attachments (the URL alone can't be re-sent on update).
        if (entry) return { ...entry, fileId: fid };
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

  // Reactions: the viewer's own reaction (for the react button) and the
  // per-emoji breakdown (for the reacts bar on the post page).
  if (viewerId) {
    const mine = await ReactModel.findOne({ actorId: viewerId, target: id })
      .select("emoji")
      .lean();
    response.myReact = mine?.emoji ?? null;
  } else {
    response.myReact = null;
  }
  const reactGroups = await ReactModel.aggregate([
    { $match: { target: id } },
    { $group: { _id: "$emoji", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  response.reactCounts = reactGroups
    .filter((g) => g._id)
    .map((g) => ({ emoji: g._id, count: g.count }));

  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }
});
