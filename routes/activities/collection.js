// routes/activities/collection.js
import route from "../utils/route.js";
import getVisibleCollection from "#methods/get/visibleCollection.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, query, set }) => {
  const { before, page, itemsPerPage, sort, select, actorId } = query;

  const result = await getVisibleCollection("activity", {
    viewerId: req.user?.id || null,
    before,
    page: page ? Number(page) : undefined,
    itemsPerPage: itemsPerPage ? Number(itemsPerPage) : 20,
    sort: sort || "-createdAt",
    select,
    query: actorId ? { actorId } : {},
  });

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}${req.path}`;
  const fullUrl = page ? `${baseUrl}?page=${page}` : baseUrl;

  for (const [index, activity] of Object.entries(
    activityStreamsCollection({
      id: fullUrl,
      orderedItems: result.items,
      totalItems: result.totalItems,
      page: result.page,
      itemsPerPage: result.itemsPerPage,
      baseUrl: baseUrl + "activities",
    })
  )) {
    set(index, activity);
  }
});
