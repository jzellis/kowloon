// /routes/events/collection.js
import route from "../utils/route.js";
import { FeedItems } from "#schema";
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
    type, // Optional subtype filter
    actorId, // Optional: filter by owner/creator
  } = query;

  const viewerId = req.user?.id || null;

  // Build base visibility filter
  const filter = buildVisibilityFilter(viewerId);

  // Add objectType filter (we want Events)
  filter.objectType = "Event";

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

  // Query FeedItems
  const items = await FeedItems.find(filter)
    .sort({ publishedAt: -1, _id: -1 }) // Stable sort
    .limit(Number(limit) + 1) // Fetch one extra for hasMore
    .lean();

  // Check if there are more items
  const hasMore = items.length > limit;
  if (hasMore) items.pop(); // Remove the extra item

  // Total count
  const totalItems = await FeedItems.countDocuments({
    objectType: "Event",
    ...buildVisibilityFilter(viewerId),
  });

  // Build context for capability evaluation
  const actorIds = [...new Set(items.map((i) => i.actorId))];
  const followerMap = await buildFollowerMap(actorIds);
  const membershipMap = await buildMembershipMap([]);

  // Enrich items with per-viewer capabilities
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
  const pageNum = page ? Number(page) : 1;
  const fullUrl = `${baseUrl}?page=${pageNum}`;

  // Build ActivityStreams OrderedCollection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: enrichedItems.map((item) => ({
      ...item.object,
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
