// routes/users/circles.js
// GET /users/:id/circles — List user's circles (owner-only)

import route from "../utils/route.js";
import { Circle } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

export default route(async ({ req, params, query, user, set, setStatus }) => {
  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return;
  }

  const userId = decodeURIComponent(params.id);

  // Only the user themselves can view their circles
  if (user.id !== userId) {
    setStatus(403);
    set("error", "Access denied");
    return;
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip = (page - 1) * limit;

  // Return user-created circles only (type: "Circle").
  // Following is also type "Circle" so it appears here naturally.
  // System-only circles (Blocked, Muted, Groups, All Following) are excluded.
  const filter = { actorId: userId, type: "Circle", deletedAt: null };

  const [docs, total] = await Promise.all([
    Circle.find(filter)
      .select("id name summary icon memberCount to createdAt updatedAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Circle.countDocuments(filter),
  ]);

  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const base = `${protocol}://${domain}/users/${encodeURIComponent(userId)}/circles`;

  const collection = activityStreamsCollection({
    id: `${base}?page=${page}`,
    orderedItems: docs,
    totalItems: total,
    page,
    itemsPerPage: limit,
    baseUrl: base,
  });

  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
