import route from "../utils/route.js";
import getVisibleReacts from "#methods/get/visibleReacts.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, params, query, setStatus }) => {
  const id = decodeURIComponent(params.id);
  const { before, limit = 50, select } = query;

  const { items, count, nextCursor } = await getVisibleReacts(id, {
    viewerId: req.user?.id || null,
    before,
    limit: Number(limit),
    select,
  });

  if (!items.length) {
    setStatus(404);
    return { error: "No visible reactions or object not found" };
  }

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const fullUrl = `${protocol}://${domain}${req.path}`;

  // Note: reacts uses cursor-based pagination, not page-based
  // For now, return as unpaginated collection
  return activityStreamsCollection({
    id: fullUrl,
    orderedItems: items,
    totalItems: count,
  });
});
