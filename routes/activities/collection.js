import route from "../utils/route.js";
import getVisibleCollection from "#methods/get/visibleCollection.js";

export default route(async ({ req, query, set }) => {
  const { before, page, itemsPerPage, sort, select, actorId } = query;

  const result = await getVisibleCollection("activity", {
    viewerId: req.user?.id || null,
    before,
    page: page ? Number(page) : undefined,
    itemsPerPage: itemsPerPage ? Number(itemsPerPage) : 20,
    sort: sort || "-createdAt",
    select, // e.g. "id actorId to content createdAt"
    query: actorId ? { actorId } : {}, // any extra filters for this resource
  });

  set("items", result.items);
  set("count", result.count);
  if (result.nextCursor) set("nextCursor", result.nextCursor);
  if (result.totalItems !== undefined) {
    set("page", result.page);
    set("itemsPerPage", result.itemsPerPage);
    set("totalItems", result.totalItems);
  }
});
