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
import { FeedItems, File, React as ReactModel } from "#schema";
import feedItemToPost from "#methods/feed/feedItemToPost.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { buildFileUrl, isPublicVisibility } from "#methods/files/signedUrl.js";

export default route(async ({ req, query, user, set, setStatus }) => {
  // Determine visibility tiers for this viewer
  let isLocal = false;
  if (user?.id) {
    const parsed = kowloonId(user.id);
    isLocal = parsed.domain && isLocalDomain(parsed.domain);
  }

  // Optional ?to=public|server restricts the visibility tier — used by mobile
  // and other clients to request explicit firehoses. Omitted = the default
  // merged view (public + server for authed local users; public only otherwise).
  const toFilter = query.to ? String(query.to).toLowerCase() : null;
  if (toFilter === "server" && !isLocal) {
    setStatus(403);
    set("error", "Server-only posts are restricted to authenticated local users");
    return;
  }

  const visibilityFilter =
    toFilter === "public"
      ? "public"
      : toFilter === "server"
      ? "server"
      : isLocal
      ? { $in: ["public", "server"] }
      : "public";

  const filter = {
    to: visibilityFilter,
    tombstoned: { $ne: true },
    objectType: "Post",
  };

  if (query.type) {
    const types = String(query.type).split(",").map((s) => s.trim()).filter(Boolean);
    filter.type = types.length > 1 ? { $in: types } : types[0];
  }
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
  const restrictedFiles = new Set();
  for (const doc of docs) {
    const obj = doc.object ?? {};
    const restricted = !isPublicVisibility(obj.to ?? doc.to);
    const add = (id) => {
      if (!id?.startsWith?.("file:")) return;
      fileIds.add(id);
      if (restricted) restrictedFiles.add(id);
    };
    add(obj.image);
    for (const id of obj.attachments ?? []) add(id);
  }

  // Resolve local file IDs to app-served URLs (GET /files/:id). Public files get
  // a plain, cacheable, federation-friendly URL; restricted files get a
  // short-lived signed URL so authorized <img> loads work without a token.
  const presignedMap = new Map(); // fileId → { url, mediaType, name }
  if (fileIds.size > 0) {
    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id mediaType name summary")
      .lean();
    for (const f of files) {
      presignedMap.set(f.id, {
        url: buildFileUrl({ fileId: f.id, domain, protocol, restricted: restrictedFiles.has(f.id) }),
        mediaType: f.mediaType ?? "",
        name: f.name ?? f.summary ?? "",
      });
    }
  }

  // The viewer's own reaction per post (for the react button state on cards).
  let myReactByTarget = new Map();
  if (user?.id && docs.length) {
    const targetIds = docs
      .map((d) => d?.object?.id || d?.id)
      .filter(Boolean);
    const mine = await ReactModel.find({
      actorId: user.id,
      target: { $in: targetIds },
    })
      .select("target emoji")
      .lean();
    myReactByTarget = new Map(mine.map((r) => [r.target, r.emoji]));
  }

  const items = docs.map((doc) => {
    const item = feedItemToPost(doc);
    item.myReact = myReactByTarget.get(item.id) ?? null;

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
