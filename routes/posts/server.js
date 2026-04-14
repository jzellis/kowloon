// routes/posts/server.js
// GET /posts/server — Server-only posts, local auth required.
//
// Now that GET /posts merges public + server for authenticated local users,
// this endpoint still exists for clients that want server-only posts explicitly.

import route from "../utils/route.js";
import { FeedItems } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import feedItemToPost from "#methods/feed/feedItemToPost.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default route(async ({ req, query, user, set, setStatus }) => {
  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return;
  }

  const parsed = kowloonId(user.id);
  if (!parsed.domain || !isLocalDomain(parsed.domain)) {
    setStatus(403);
    set("error", "Server posts are only visible to local users");
    return;
  }

  const domain = getSetting("domain");
  const page   = Math.max(1, parseInt(query.page,  10) || 1);
  const limit  = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip   = (page - 1) * limit;

  const filter = {
    to: "server",
    tombstoned: { $ne: true },
    objectType: "Post",
  };
  if (query.type)  filter.type        = query.type;
  if (query.since) filter.publishedAt = { $gte: new Date(query.since) };

  const [docs, total] = await Promise.all([
    FeedItems.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    FeedItems.countDocuments(filter),
  ]);

  const items = docs.map(feedItemToPost);

  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base     = `${protocol}://${domain}/posts/server`;

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
