// routes/users/collection.js
import route from "../utils/route.js";
import { User } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";
import sanitizeObject from "#methods/sanitize/object.js";
import { getViewerContext } from "#methods/visibility/context.js";

export default route(async ({ req, query, set }) => {
  const { page, limit } = query;

  const pageNum = page ? Number(page) : 1;
  const itemsPerPage = limit ? Number(limit) : 20;
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Active users are always discoverable. Personal-info fields are gated
  // per-user at sanitize time based on the user's `to` audience.
  const userQuery = { deletedAt: null, active: true };

  const [users, total] = await Promise.all([
    User.find(userQuery)
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(itemsPerPage)
      .lean(),
    User.countDocuments(userQuery),
  ]);

  const viewer = await getViewerContext(req.user?.id || null);
  const items  = users.map((u) => sanitizeObject(u, { objectType: "User", viewer }));

  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/users`;
  const fullUrl = pageNum ? `${baseUrl}?page=${pageNum}` : baseUrl;

  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: items,
    totalItems: total,
    page: pageNum,
    itemsPerPage,
    baseUrl,
  });

  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
