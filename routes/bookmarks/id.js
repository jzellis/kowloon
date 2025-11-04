import route from "../utils/route.js";
import { FeedCache } from "#schema";
import {
  canView,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params;
  const viewerId = req.user?.id || null;

  // Lookup in FeedCache
  const feedCacheItem = await FeedCache.findOne({
    id,
    objectType: "Bookmark",
    deletedAt: null,
    tombstoned: { $ne: true },
  }).lean();

  if (!feedCacheItem) {
    setStatus(404);
    set("error", "Bookmark not found");
    return;
  }

  // Check visibility
  const followerMap = await buildFollowerMap([feedCacheItem.actorId]);
  const membershipMap = await buildMembershipMap([]);

  const allowed = await canView(feedCacheItem, viewerId, {
    followerMap,
    membershipMap,
    grants: {},
  });

  if (!allowed) {
    setStatus(403);
    set("error", "Access denied");
    return;
  }

  // Enrich with capabilities
  const enriched = enrichWithCapabilities(feedCacheItem, viewerId, {
    followerMap,
    membershipMap,
    grants: {},
    addressedIds: [],
  });

  // Return object with capabilities
  const response = {
    ...enriched.object,
    canReply: enriched.canReply,
    canReact: enriched.canReact,
    publishedAt: enriched.publishedAt,
    updatedAt: enriched.updatedAt,
  };

  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }
});
