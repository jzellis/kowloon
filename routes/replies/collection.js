import route from "../utils/route.js";
import getVisibleReplies from "#methods/get/visibleReplies.js";

export default route(async ({ req, params, query, set, setStatus }) => {
  const id = decodeURIComponent(params.id);
  const { before, limit = 50, select } = query;

  const { items, count, nextCursor } = await getVisibleReplies(id, {
    viewerId: req.user?.id || null,
    before,
    limit: Number(limit),
    select,
  });

  if (!items.length) {
    setStatus(404);
    set("error", "No visible replies or object not found");
    return;
  }

  set("items", items);
  set("count", count);
  if (nextCursor) set("nextCursor", nextCursor);
});
