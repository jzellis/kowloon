// routes/users/circles.js
import route from "../utils/route.js";
import getCollection from "#methods/core/getCollection.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, params, query, set, setStatus }) => {
  const userId = decodeURIComponent(params.id);
  if (!userId.startsWith("@")) {
    setStatus(400);
    set("error", "Invalid user id");
    return;
  }

  const {
    before, // Cursor for pagination (ISO date string)
    page, // Page number (for compatibility)
    limit,
    objectType, // Optional subtype filter if Circles have subtypes
  } = query;

  const pageNum = page ? Number(page) : 1;
  const itemsPerPage = limit ? Number(limit) : 20;
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Build filters - filter by the user's actorId
  const filters = { actorId: userId };

  // Cursor-based pagination (if before is provided)
  if (before) {
    filters.publishedAt = { $lt: new Date(before) };
  }

  // Query collection using getCollection function
  const result = await getCollection({
    type: "Circle",
    objectType, // optional subtype filter
    actorId: req.user?.id || undefined, // viewer for visibility
    limit: itemsPerPage + (before ? 1 : 0), // Fetch one extra for cursor pagination
    offset,
    sortBy: "createdAt",
    sortOrder: -1,
    filters,
  });

  // For cursor-based pagination, check if there are more items
  let items = result.items;
  let hasMore = result.hasMore;
  if (before && items.length > itemsPerPage) {
    hasMore = true;
    items = items.slice(0, itemsPerPage);
  }

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/users/${encodeURIComponent(userId)}/circles`;
  const fullUrl = pageNum ? `${baseUrl}?page=${pageNum}` : baseUrl;

  // Build ActivityStreams OrderedCollection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: items.map((item) => ({
      ...item.object, // The full object envelope
      // Add per-viewer visibility flags (nested to avoid conflict with server domain field)
      visibility: {
        public: item._visibility?.public,
        server: item._visibility?.server,
        canReply: item._visibility?.canReply,
        canReact: item._visibility?.canReact,
      },
    })),
    totalItems: result.total,
    page: pageNum,
    itemsPerPage,
    baseUrl,
  });

  // Next cursor for pagination (if using cursor-based)
  if (before && hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    const lastDate = lastItem.publishedAt || lastItem.createdAt;
    collection.next = `${baseUrl}?before=${new Date(
      lastDate
    ).toISOString()}&limit=${itemsPerPage}`;
  }

  // Set response fields
  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
