// /routes/groups/collection.js
import route from "../utils/route.js";
import getVisibleCollection from "#methods/get/visibleCollection.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

/**
 * GET /groups
 * Lists discoverable groups. Returns an ActivityStreams OrderedCollection
 * Query:
 *  - page (default 1)
 *  - itemsPerPage (default 50, max 200)
 *  - q (optional text search; name/description)
 */
export default route(async ({ req, query, set }) => {
  const page = Number(query.page || 1);
  const itemsPerPage = Math.max(
    1,
    Math.min(200, Number(query.itemsPerPage || 50))
  );
  const q = (query.q || "").toString().trim();

  // Build search filter if query is provided
  const searchFilter = {};
  if (q) {
    searchFilter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const result = await getVisibleCollection("group", {
    viewerId: req.user?.id || null,
    page,
    itemsPerPage,
    sort: "-updatedAt",
    query: searchFilter,
  });

  // Map to expected format
  const orderedItems = result.items.map((g) => ({
    id: g.id,
    type: "Group",
    name: g.name,
    summary: g.description,
    icon: g.icon,
    url: g.url,
    to: g.to,
    canReply: g.canReply,
    canReact: g.canReact,
    updatedAt: g.updatedAt,
  }));

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}${req.path}`;
  const fullUrl = page ? `${baseUrl}?page=${page}` : baseUrl;

  return activityStreamsCollection({
    id: fullUrl,
    orderedItems,
    totalItems: result.totalItems,
    page,
    itemsPerPage,
    baseUrl,
  });
});
