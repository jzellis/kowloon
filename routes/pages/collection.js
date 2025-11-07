// routes/pages/collection.js
import route from "../utils/route.js";
import { getCollection } from "#methods/collections/index.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

/**
 * Build hierarchical tree structure from flat page list
 * Pages are ordered by the `order` field within each level
 * @param {Array} items - Flat list of page items
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
          public: item._visibility?.public,
          server: item._visibility?.server,
          canReply: item._visibility?.canReply,
          canReact: item._visibility?.canReact,
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
    limit,
    objectType, // Optional: filter by "Page" or "Folder"
    actorId, // Optional: filter by author
  } = query;

  const pageNum = page ? Number(page) : 1;
  const itemsPerPage = limit ? Number(limit) : 500; // Higher default for pages (entire tree)
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Build filters
  const filters = {};
  if (actorId) {
    filters.actorId = actorId;
  }

  // Query collection using getCollection function
  // Note: For hierarchical pages, we fetch ALL items to build the tree
  // Pagination is tricky with tree structures
  const result = await getCollection({
    type: "Page",
    objectType, // optional: "Page" or "Folder"
    actorId: req.user?.id || undefined, // viewer for visibility
    limit: itemsPerPage,
    offset,
    sortBy: "createdAt",
    sortOrder: -1,
    filters,
  });

  // Build hierarchical tree structure ordered by `order` field
  const tree = buildPageTree(result.items);

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/pages`;
  const fullUrl = pageNum ? `${baseUrl}?page=${pageNum}` : baseUrl;

  // Build ActivityStreams OrderedCollection with hierarchical items
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: tree, // Hierarchical tree instead of flat list
    totalItems: result.total,
    page: pageNum,
    itemsPerPage,
    baseUrl,
  });

  // Set response fields
  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
