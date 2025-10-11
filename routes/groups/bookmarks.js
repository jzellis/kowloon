// routes/groups/bookmarks.js
import route from "../utils/route.js";
import getVisibleBookmarks from "#methods/get/visibleBookmarks.js";

export default route(async ({ req, params, query, set, setStatus }) => {
  const ownerId = decodeURIComponent(params.id);
  if (!ownerId.startsWith("group:")) {
    setStatus(400);
    set("error", "Invalid group id");
    return;
  }

  const { before, limit = 50, select } = query;

  const { items, count, nextCursor } = await getVisibleBookmarks(
    "group",
    ownerId,
    {
      viewerId: req.user?.id || null,
      before,
      limit: Number(limit),
      select,
    }
  );

  set("items", items);
  set("count", count);
  if (nextCursor) set("nextCursor", nextCursor);
});
