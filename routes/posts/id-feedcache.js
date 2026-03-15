// /routes/posts/id-feedcache.js
// GET /posts/:id using FeedItems as the read layer

import route from "../utils/route.js";
import { FeedItems } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params; // e.g. "post:123@domain.com"
  const viewerId = req.user?.id || null;

  const feedCacheItem = await FeedItems.findOne({
    id,
    deletedAt: null,
    tombstoned: { $ne: true },
  }).lean();

  if (!feedCacheItem) {
    setStatus(404);
    set("error", "Object not found");
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

  setStatus(200);
  set("object", enriched.object);
  set("canReply", enriched.canReply);
  set("canReact", enriched.canReact);
  set("publishedAt", enriched.publishedAt);
  set("updatedAt", enriched.updatedAt);
  set("actorId", enriched.actorId);
});
