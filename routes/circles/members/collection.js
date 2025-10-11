import route from "../../utils/route.js";
import getMembers from "#methods/get/members.js";

export default route(async ({ req, params, query, set, setStatus }) => {
  const circleId = decodeURIComponent(params.id);
  const { before, limit = 100 } = query;

  const { items, count, nextCursor } = await getMembers("circle", circleId, {
    viewerId: req.user?.id || null,
    path: "members",
    before,
    limit: Number(limit),
  });

  if (!count && !nextCursor && !items.length) {
    // either not found OR not visible; differentiate only if you want to
    // here we say 404 to avoid leaking existence
    setStatus(404);
    set("error", "Circle not found or not visible");
    return;
  }

  set("items", items);
  set("count", count);
  if (nextCursor) set("nextCursor", nextCursor);
});
