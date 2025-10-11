import route from "../../utils/route.js";
import getMembers from "#methods/get/members.js";

export default route(async ({ req, params, query, set, setStatus }) => {
  const groupId = decodeURIComponent(params.id);
  const { before, limit = 100 } = query;

  const { items, count, nextCursor } = await getMembers("group", groupId, {
    viewerId: req.user?.id || null,
    path: "members",
    before,
    limit: Number(limit),
  });

  if (!count && !nextCursor && !items.length) {
    setStatus(404);
    set("error", "Group not found or not visible");
    return;
  }

  set("items", items);
  set("count", count);
  if (nextCursor) set("nextCursor", nextCursor);
});
