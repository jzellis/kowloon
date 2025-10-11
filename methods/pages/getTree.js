// #methods/pages/getTree.js
import getVisibleCollection from "#methods/get/visibleCollection.js";
import buildTree from "#methods/pages/buildTree.js";

export default async function getPagesTree({ viewerId, select, sort } = {}) {
  // Pull what's needed to build a tree
  const result = await getVisibleCollection("page", {
    viewerId: viewerId || null,
    // Select minimal fields for the tree
    select:
      select ||
      "id type title slug parentFolder order url href actorId to createdAt",
    // sort parents before children (createdAt works fine;
    // we'll re-sort siblings by order/title below)
    sort: sort || "createdAt",
    itemsPerPage: 10000, // adjust if needed; or add pagination for very large sets
  });

  // Optional: ensure stable sibling ordering
  const pages = result.items.slice().sort((a, b) => {
    if ((a.order ?? 0) !== (b.order ?? 0))
      return (a.order ?? 0) - (b.order ?? 0);
    return (a.title || "").localeCompare(b.title || "");
    // children will be placed under parents by buildTree
  });

  const tree = buildTree(pages);
  return { tree, count: pages.length };
}
