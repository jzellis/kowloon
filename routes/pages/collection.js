import route from "../utils/route.js";
import { FeedCache } from "#schema";
import {
  buildVisibilityFilter,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, query, set }) => {
  const {
    before,
    page,
    itemsPerPage = 20,
    type,
    actorId,
  } = query;

  const viewerId = req.user?.id || null;
  const limit = Number(itemsPerPage);

  // Build visibility filter using FeedCache
  const filter = buildVisibilityFilter(viewerId);
  filter.objectType = "Page";

  // Optional filters
  if (type) filter.type = type;
  if (actorId) filter.actorId = actorId;
  if (before) filter.publishedAt = { $lt: new Date(before) };

  // Query FeedCache
  const items = await FeedCache.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  // Build context for capabilities
  const actorIds = [...new Set(items.map((i) => i.actorId))];
  const followerMap = await buildFollowerMap(actorIds);
  const membershipMap = await buildMembershipMap([]);

  // Enrich with per-viewer capabilities
  const enrichedItems = items.map((item) =>
    enrichWithCapabilities(item, viewerId, {
      followerMap,
      membershipMap,
      grants: {},
      addressedIds: [],
    })
  );

  set("items", enrichedItems.map((item) => ({
    ...item.object,
    canReply: item.canReply,
    canReact: item.canReact,
  })));
  set("count", items.length);

  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    set("nextCursor", lastItem.publishedAt.toISOString());
  }

  if (page !== undefined) {
    set("page", Number(page));
    set("itemsPerPage", limit);
  }
});
