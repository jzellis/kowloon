// #methods/pages/getByPath.js
import { Page } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { buildVisibilityQuery } from "#methods/visibility/filter.js";
import objectById from "#methods/get/objectById.js";

function isIdPath(path) {
  return (
    typeof path === "string" && (path.includes(":") || path.startsWith("page:"))
  );
}

/**
 * Resolve a page by:
 *  - Full ID: "page:uuid@domain"
 *  - Single slug: "about"
 *  - Nested slug path: "docs/getting-started/cli"
 *
 * Returns { item } or null (not found / not visible)
 */
export default async function getPageByPath(path, { viewerId, select } = {}) {
  if (!path) return null;

  // ID mode
  if (isIdPath(path)) {
    const item = await objectById("page", decodeURIComponent(path), {
      viewerId: viewerId || null,
      select:
        select ||
        "id type title slug parentFolder order url href actorId to body createdAt",
    });
    return item ? { item } : null;
  }

  // Slug mode (can be nested)
  const slugs = path.split("/").filter(Boolean);
  const ctx = await getViewerContext(viewerId || null);
  const vis = buildVisibilityQuery(ctx);

  // Walk down the chain: parentFolder == previous id, starting at null
  let parentId = null;
  let found = null;

  for (const slug of slugs) {
    const filter = {
      ...vis,
      deletedAt: null,
      slug,
      parentFolder: parentId, // first hop uses null
    };

    found = await Page.findOne(filter)
      .select(
        (select ||
          "id type title slug parentFolder order url href actorId to body createdAt") +
          " -_id -__v"
      )
      .lean();

    if (!found) return null; // missing or not visible in the chain
    parentId = found.id; // dive to next level
  }

  return found ? { item: found } : null;
}
