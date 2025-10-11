import route from "../utils/route.js";
import getVisibleReacts from "#methods/get/visibleReacts.js";

export default route(async ({ req, params, query, set, setStatus }) => {
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
    set("error", "No visible reactions or object not found");
    return;
  }

  set("items", items);
  set("count", count);
  if (nextCursor) set("nextCursor", nextCursor);
});
