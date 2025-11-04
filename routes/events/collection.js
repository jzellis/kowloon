import route from "../utils/route.js";
import { FeedCache } from "#schema";
import {
  buildVisibilityFilter,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

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
  filter.objectType = "Event";

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

  // Total count
  const totalItems = await FeedCache.countDocuments({
    objectType: "Event",
    deletedAt: null,
    tombstoned: { $ne: true },
  });

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

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}${req.path}`;
  const fullUrl = page ? `${baseUrl}?page=${page}` : baseUrl;

  // Build ActivityStreams collection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: enrichedItems.map((item) => ({
      ...item.object,
      canReply: item.canReply,
      canReact: item.canReact,
    })),
    totalItems,
    page: page ? Number(page) : undefined,
    itemsPerPage: limit,
    baseUrl,
  });

  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    collection.next = `${baseUrl}?before=${lastItem.publishedAt.toISOString()}&itemsPerPage=${limit}`;
  }

  for (const [index, value] of Object.entries(collection)) {
    set(index, value);
  }
});
