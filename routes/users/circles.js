// routes/users/circles.js
// GET /users/:id/circles — List a user's user-created circles.
// Owner sees all; others see only @public circles, plus @<domain>-scoped
// circles when viewer is authenticated on the same server.

import route from "../utils/route.js";
import { Circle } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";
import { domainOf } from "#methods/visibility/context.js";

export default route(async ({ req, params, query, user, set }) => {
  const userId = decodeURIComponent(params.id);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
  const skip = (page - 1) * limit;

  const filter = { actorId: userId, type: "Circle", deletedAt: null };

  const isOwner = !!(user?.id && user.id === userId);
  if (!isOwner) {
    const userDomain   = domainOf(userId);
    const viewerDomain = user?.id ? domainOf(user.id) : null;
    const sameServer   = !!(viewerDomain && userDomain && viewerDomain === userDomain);
    const audience     = ["@public"];
    if (sameServer) audience.push(`@${userDomain}`);
    filter.to = { $in: audience };
  }

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
}, { allowUnauth: true });
