// routes/users/bookmarks.js
import route from "../utils/route.js";
import { getCollection } from "#methods/collections/index.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

/**
 * Build hierarchical tree structure from flat bookmark list
 * @param {Array} items - Flat list of bookmark items
 * @returns {Array} Hierarchical tree with folders containing children
 */
function buildBookmarkTree(items) {
  // Separate items by parentFolder
  const itemsByParent = new Map();
  const allItems = new Map();

  // First pass: organize by parent and index all items
  for (const item of items) {
    allItems.set(item.object.id, item);
    const parentId = item.object.parentFolder || null;

    if (!itemsByParent.has(parentId)) {
      itemsByParent.set(parentId, []);
    }
    itemsByParent.get(parentId).push(item);
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

export default route(async ({ req, params, query, set, setStatus }) => {
  const userId = decodeURIComponent(params.id);
  if (!userId.startsWith("@")) {
    setStatus(400);
    set("error", "Invalid user id");
    return;
  }

  const {
    page, // Page number (for compatibility, though tree structure doesn't paginate well)
    limit,
    objectType, // Optional: filter by "Folder" or "Bookmark"
  } = query;

  const pageNum = page ? Number(page) : 1;
  const itemsPerPage = limit ? Number(limit) : 500; // Higher default for bookmarks
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Build filters - filter by the user's actorId
  const filters = { actorId: userId };

  // Query collection using getCollection function
  // Note: For hierarchical bookmarks, we fetch ALL items to build the tree
  // Pagination is tricky with tree structures
  const result = await getCollection({
    type: "Bookmark",
    objectType, // optional: "Folder" or "Bookmark"
    actorId: req.user?.id || undefined, // viewer for visibility
    limit: itemsPerPage,
    offset,
    sortBy: "createdAt",
    sortOrder: -1,
    filters,
  });

  // Build hierarchical tree structure
  const tree = buildBookmarkTree(result.items);

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/users/${encodeURIComponent(userId)}/bookmarks`;
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
