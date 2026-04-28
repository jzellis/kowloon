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

// Build a proxied serve URL from the current request host (dev-safe).
// Appends ?token= when a viewer JWT is present so <img> tags can load private files.
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

export default route(async ({ req, query, user, set }) => {
  // Extract raw JWT for signing file URLs (so <img> tags can load private files)
  const viewerToken = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const localDomain = getSetting("domain");

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

  // Collect all File IDs used in `image` or `attachments` across all docs
  const fileIds = new Set();
  for (const doc of docs) {
    const obj = doc.object ?? {};
    if (obj.image?.startsWith("file:"))       fileIds.add(obj.image);
    for (const id of obj.attachments ?? []) {
      if (id?.startsWith("file:")) fileIds.add(id);
    }
  }

  // Fetch all needed file records in one query
  const fileMap = new Map();
  if (fileIds.size > 0) {
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id url mediaType name summary")
      .lean();
    for (const f of files) fileMap.set(f.id, f);
  }

  const items = docs.map((doc) => {
    const item = feedItemToPost(doc);

    // Resolve featured image
    if (item.image) {
      if (item.image.startsWith("file:")) {
        item.featuredImage = serveUrl(req, item.image, viewerToken, localDomain);
      } else if (item.image.startsWith("http")) {
        item.featuredImage = item.image;
      }
    }

    // Resolve attachments: replace File ID strings with {url, mediaType, name} objects
    if (item.attachments?.length) {
      item.attachments = item.attachments
        .map((id) => {
          if (!id) return null;
          const f = fileMap.get(id);
          if (f) return { url: serveUrl(req, id, viewerToken, localDomain), mediaType: f.mediaType ?? "", name: f.name ?? f.summary ?? "" };
          if (id.startsWith("file:")) return { url: serveUrl(req, id, viewerToken, localDomain), mediaType: "", name: "" };
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
