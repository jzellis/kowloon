// routes/posts/collection.js
// GET /posts — Public firehose.
//
// Visibility:
//   - Unauthenticated / remote users → @public posts only
//   - Authenticated local users      → @public + @server posts
//
// Queries FeedItems (not Post directly) so federated posts and visibility tiers
// are handled consistently across the whole application.

import route from "../utils/route.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { FeedItems, File } from "#schema";
import feedItemToPost from "#methods/feed/feedItemToPost.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getStorageAdapter } from "#methods/files/index.js";

export default route(async ({ req, query, user, set }) => {
  // Determine visibility tiers for this viewer
  let isLocal = false;
  if (user?.id) {
    const parsed = kowloonId(user.id);
    isLocal = parsed.domain && isLocalDomain(parsed.domain);
  }

  const visibilityFilter = isLocal
    ? { $in: ["public", "server"] }
    : "public";

  const filter = {
    to: visibilityFilter,
    tombstoned: { $ne: true },
    objectType: "Post",
  };

  if (query.type)     filter.type       = query.type;
  if (query.since)    filter.publishedAt = { $gte: new Date(query.since) };
  if (query.serverId) filter.server      = query.serverId;

  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip  = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    FeedItems.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    FeedItems.countDocuments(filter),
  ]);

  // Collect all local file IDs used in `image` or `attachments` across all docs
  const fileIds = new Set();
  for (const doc of docs) {
    const obj = doc.object ?? {};
    if (obj.image?.startsWith("file:")) fileIds.add(obj.image);
    for (const id of obj.attachments ?? []) {
      if (id?.startsWith("file:")) fileIds.add(id);
    }
  }

  // Generate presigned URLs for all local files in one pass (pure local crypto — no network calls)
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
      } catch { /* non-fatal: file omitted from response */ }
    }));
  }

  const items = docs.map((doc) => {
    const item = feedItemToPost(doc);

    // Resolve featured image
    if (item.image?.startsWith("file:")) {
      item.featuredImage = presignedMap.get(item.image)?.url ?? null;
    } else if (item.image?.startsWith("http")) {
      item.featuredImage = item.image;
    }

    // Resolve attachments: replace file IDs with {url, mediaType, name} objects
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

  const domain   = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base     = `${protocol}://${domain}${req.baseUrl}`;

  const collection = activityStreamsCollection({
    id: `${base}?page=${page}`,
    orderedItems: items,
    totalItems: total,
    page,
    itemsPerPage: limit,
    baseUrl: base,
  });

  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
