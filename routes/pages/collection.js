// routes/pages/collection.js
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

/**
 * Build hierarchical tree structure from flat page list
 * Pages are ordered by the `order` field within each level
 * @param {Array} items - Flat list of enriched FeedCache items
 * @returns {Array} Hierarchical tree with folders containing children
 */
function buildPageTree(items) {
  // Separate items by parentFolder
  const itemsByParent = new Map();

  // First pass: organize by parent
  for (const item of items) {
    const parentId = item.object.parentFolder || null;

    if (!itemsByParent.has(parentId)) {
      itemsByParent.set(parentId, []);
    }
    itemsByParent.get(parentId).push(item);
  }

  // Sort each level by order field
  for (const [parentId, children] of itemsByParent.entries()) {
    children.sort((a, b) => {
      const orderA = a.object.order || 0;
      const orderB = b.object.order || 0;
      return orderA - orderB;
    });
  }

  // Recursive function to build tree for a given parent
  function buildSubtree(parentId) {
    const children = itemsByParent.get(parentId) || [];

    return children.map((item) => {
      const node = {
        ...item.object,
        visibility: {
          public: item.to === "public" || item.to === "@public",
          server: item.to === "server",
          canReply: item.canReply,
          canReact: item.canReact,
        },
      };

      // If this is a folder, recursively add its children
      if (item.object.type === "Folder") {
        const childNodes = buildSubtree(item.object.id);
        if (childNodes.length > 0) {
          node.children = childNodes;
        }
      }

      return node;
    });
  }

  // Build tree starting from root items (no parent)
  return buildSubtree(null);
}

export default route(async ({ req, query, set }) => {
  const {
    page, // Page number (for compatibility, though tree structure doesn't paginate well)
    limit = 500, // Higher default for pages (entire tree)
    type, // Optional: filter by "Page" or "Folder"
    actorId, // Optional: filter by author
  } = query;

  const viewerId = req.user?.id || null;

  // Build base visibility filter
  const filter = buildVisibilityFilter(viewerId);

  // Add objectType filter (we want Pages)
  filter.objectType = "Page";

  // Optional: filter by subtype
  if (type) {
    filter.type = type;
  }

  // Optional: filter by author
  if (actorId) {
    filter.actorId = actorId;
  }

  // Query FeedCache - fetch all pages to build tree
  const items = await FeedCache.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(Number(limit))
    .lean();

  // Total count
  const totalItems = await FeedCache.countDocuments({
    objectType: "Page",
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

  // Build hierarchical tree structure ordered by `order` field
  const tree = buildPageTree(enrichedItems);

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}${req.path}`;
  const pageNum = page ? Number(page) : 1;
  const fullUrl = `${baseUrl}?page=${pageNum}`;

  // Build ActivityStreams OrderedCollection with hierarchical items
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: tree, // Hierarchical tree instead of flat list
    totalItems,
    page: pageNum,
    itemsPerPage: Number(limit),
    baseUrl,
  });

  // Set response fields
  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
