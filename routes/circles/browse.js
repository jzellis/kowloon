// routes/circles/browse.js
// GET /circles/browse — Browse public/server-visible circles with sorting.
// Available to all viewers (unauthenticated gets @public only; local users get @public + @server).

import route from "../utils/route.js";
import { activityStreamsCollection } from "../utils/oc.js";
import { Circle } from "#schema";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default route(
  async ({ req, query, user, set }) => {
    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip = (page - 1) * limit;

    // Visibility filter
    const filter = { deletedAt: null, type: "Circle" };
    let isLocal = false;
    if (user?.id) {
      const parsed = kowloonId(user.id);
      isLocal = parsed.domain && isLocalDomain(parsed.domain);
    }
    if (!user?.id || !isLocal) {
      filter.to = "@public";
    } else {
      filter.to = { $in: ["@public", `@${domain}`] };
    }

    // Sort: 'reacts' → reactCount desc, default → createdAt desc
    const sort =
      query.sort === "reacts"
        ? { reactCount: -1, createdAt: -1 }
        : { createdAt: -1 };

    const [docs, total] = await Promise.all([
      Circle.find(filter)
        .select(
          "id name summary icon to memberCount reactCount actorId actor createdAt updatedAt"
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Circle.countDocuments(filter),
    ]);

    const sanitized = docs.map(({ _id, __v, ...rest }) => rest);

    const base = `${protocol}://${domain}/circles/browse`;
    const collection = activityStreamsCollection({
      id: `${base}?page=${page}`,
      orderedItems: sanitized,
      totalItems: total,
      page,
      itemsPerPage: limit,
      baseUrl: base,
    });

    for (const [key, value] of Object.entries(collection)) {
      set(key, value);
    }
  },
  { allowUnauth: true }
);
