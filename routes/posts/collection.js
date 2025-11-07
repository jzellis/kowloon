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
    before, // Cursor for pagination (ISO date string)
    page, // Page number (alternative to cursor)
    limit = 20, // Items per page
    type, // Optional subtype filter (Note/Article/Media/Link)
    actorId, // Optional: filter by author
  } = query;

  const viewerId = req.user?.id || null;

  // Build base visibility filter
  // This handles public/server/audience visibility based on viewer authentication
  const filter = buildVisibilityFilter(viewerId);

  // Add objectType filter (we want Posts)
  filter.objectType = "Post";

  // Optional: filter by subtype
  if (type) {
    filter.type = type;
  }

  // Optional: filter by author
  if (actorId) {
    filter.actorId = actorId;
  }

  // Cursor-based pagination
  if (before) {
    filter.publishedAt = { $lt: new Date(before) };
  }

  // Query FeedCache
  const items = await FeedCache.find(filter)
    .sort({ publishedAt: -1, _id: -1 }) // Stable sort
    .limit(Number(limit) + 1) // Fetch one extra for hasMore
    .lean();

  // Check if there are more items
  const hasMore = items.length > limit;
  if (hasMore) items.pop(); // Remove the extra item

  // Total count (expensive, consider caching or removing)
  const totalItems = await FeedCache.countDocuments({
    objectType: "Post",
    ...buildVisibilityFilter(viewerId),
  });

  // Build context for capability evaluation
  const actorIds = [...new Set(items.map((i) => i.actorId))];
  const followerMap = await buildFollowerMap(actorIds);

  // For local items, we'd need addressedIds - for now, pass empty
  // TODO: Consider storing addressedIds in FeedCache for read optimization
  const membershipMap = await buildMembershipMap([]);

  // Enrich items with per-viewer capabilities
  const enrichedItems = items.map((item) =>
    enrichWithCapabilities(item, viewerId, {
      followerMap,
      membershipMap,
      grants: {}, // TODO: Implement remote grants from tokens
      addressedIds: [], // TODO: Store in FeedCache or derive
    })
  );

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}${req.path}`;
  const pageNum = page ? Number(page) : 1; // Default to page 1
  const fullUrl = `${baseUrl}?page=${pageNum}`;

  // Build ActivityStreams OrderedCollection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: enrichedItems.map((item) => ({
      ...item.object, // The full object envelope
      // Add per-viewer visibility flags (nested to avoid conflict with server domain field)
      visibility: {
        public: item.to === "public" || item.to === "@public",
        server: item.to === "server",
        canReply: item.canReply,
        canReact: item.canReact,
      },
    })),
    totalItems,
    page: pageNum,
    itemsPerPage: Number(limit),
    baseUrl,
  });

  // Next cursor for pagination
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    collection.next = `${baseUrl}?before=${lastItem.publishedAt.toISOString()}&limit=${limit}`;
  }

  for (const [index, value] of Object.entries(collection)) {
    set(index, value);
  }
});
