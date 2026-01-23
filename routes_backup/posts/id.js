import route from "../utils/route.js";
import { FeedItems } from "#schema";
import {
  canView,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params; // e.g. "post:123@domain.com"
  const viewerId = req.user?.id || null;

  // Lookup in FeedItems by canonical ID (NEW: using FeedItems instead of Post)
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

  // Check visibility for this viewer (NEW: privacy check)
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

  // Enrich with per-viewer capabilities (NEW: compute canReply/canReact for this viewer)
  const enriched = enrichWithCapabilities(feedCacheItem, viewerId, {
    followerMap,
    membershipMap,
    grants: {},
    addressedIds: [],
  });

  // Return the normalized object envelope with capabilities
  const response = {
    ...enriched.object, // The full object data from FeedItems
    canReply: enriched.canReply, // NEW: Boolean for this viewer
    canReact: enriched.canReact, // NEW: Boolean for this viewer
    publishedAt: enriched.publishedAt,
    updatedAt: enriched.updatedAt,
  };

  // Set all fields on response
  for (const [key, value] of Object.entries(response)) {
    set(key, value);
  }

  // TODO: If canReply/canReact requires audience grant, include capability token
  // if (enriched.canReply && enriched.origin === "remote" && enriched.canReply === "audience") {
  //   set("replyToken", generateGrantToken(viewerId, id, "reply"));
  // }
});
