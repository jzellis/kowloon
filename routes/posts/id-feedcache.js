// /routes/posts/id-feedcache.js
// Example: GET /posts/:id using FeedCache as the read layer
// This is the NEW pattern - single object fetch via FeedCache

import route from "../utils/route.js";
import { FeedCache } from "#schema";
import {
  canView,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params; // e.g. "post:123@domain.com"
  const viewerId = req.user?.id || null;

  // Lookup in FeedCache by canonical ID
  const feedCacheItem = await FeedCache.findOne({
    id,
    deletedAt: null,
    tombstoned: { $ne: true },
  }).lean();

  if (!feedCacheItem) {
    setStatus(404);
    set("error", "Object not found");
    return;
  }

  // Check visibility for this viewer
  const followerMap = await buildFollowerMap([feedCacheItem.actorId]);
  const membershipMap = await buildMembershipMap([]); // TODO: addressedIds

  const allowed = await canView(feedCacheItem, viewerId, {
    followerMap,
    membershipMap,
    grants: {}, // TODO: Remote grants
  });

  if (!allowed) {
    setStatus(403);
    set("error", "Access denied");
    return;
  }

  // Enrich with per-viewer capabilities
  const enriched = enrichWithCapabilities(feedCacheItem, viewerId, {
    followerMap,
    membershipMap,
    grants: {},
    addressedIds: [],
  });

  // Return the normalized object envelope with capabilities
  setStatus(200);
  set("object", enriched.object); // The full object data
  set("canReply", enriched.canReply); // Boolean for this viewer
  set("canReact", enriched.canReact); // Boolean for this viewer
  set("publishedAt", enriched.publishedAt);
  set("updatedAt", enriched.updatedAt);
  set("actorId", enriched.actorId);

  // TODO: If canReply/canReact requires audience grant, include capability token
  // if (enriched.canReply && enriched.origin === "remote" && enriched.canReply === "audience") {
  //   set("replyToken", generateGrantToken(viewerId, id, "reply"));
  // }
});
