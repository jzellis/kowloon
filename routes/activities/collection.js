// routes/activities/collection.js
import route from "../utils/route.js";
import { getCollection } from "#methods/collections/index.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, query, set }) => {
  const { page, limit, objectType, actorId: filterActorId } = query;

  const pageNum = page ? Number(page) : undefined;
  const itemsPerPage = limit ? Number(limit) : 20;
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Query collection using new getCollection function
  // Note: We need to check multiple activity types since activities aren't stored
  // in FeedCache directly - they're stored as Posts, Replies, Reacts, etc.
  // For now, let's just show Posts and Replies as "activities"
  const types = ["Post", "Reply", "React"];

  // If filtering by specific actorId, add to filters
  const filters = {};
  if (filterActorId) {
    filters.actorId = filterActorId;
  }

  // Fetch all activity types in parallel
  const results = await Promise.all(
    types.map(type =>
      getCollection({
        type,
        objectType, // optional subtype filter
        actorId: req.user?.id || undefined,
        limit: itemsPerPage,
        offset,
        sortBy: "createdAt",
        sortOrder: -1,
        filters,
      })
    )
  );

  // Merge and sort all results by createdAt
  const allItems = results.flatMap(r => r.items);
  allItems.sort((a, b) => {
    const aTime = new Date(a.publishedAt || a.createdAt).getTime();
    const bTime = new Date(b.publishedAt || b.createdAt).getTime();
    return bTime - aTime; // desc
  });

  // Apply limit after merging
  const items = allItems.slice(0, itemsPerPage);
  const totalItems = results.reduce((sum, r) => sum + r.total, 0);

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/activities`;
  const fullUrl = pageNum ? `${baseUrl}?page=${pageNum}` : baseUrl;

  // Format as ActivityStreams collection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: items.map(item => ({
      ...(item.object || item),
      // Add per-viewer visibility flags (nested to avoid conflict with server domain field)
      visibility: {
        public: item._visibility?.public,
        server: item._visibility?.server,
        canReply: item._visibility?.canReply,
        canReact: item._visibility?.canReact,
      },
    })),
    totalItems,
    page: pageNum,
    itemsPerPage,
    baseUrl,
  });

  // Set response fields
  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
