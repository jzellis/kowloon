import route from "../../utils/route.js";
import getMembers from "#methods/get/members.js";
import { activityStreamsCollection } from "../../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, params, query, setStatus }) => {
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
    return { error: "Circle not found or not visible" };
  }

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const fullUrl = `${protocol}://${domain}${req.path}`;

  return activityStreamsCollection({
    id: fullUrl,
    orderedItems: items,
    totalItems: count,
  });
});
