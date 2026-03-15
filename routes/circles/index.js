// routes/circles/index.js
// Circle endpoints — all require authentication, scoped to circle owner

import express from "express";
import id from "./id.js";
import posts from "./posts.js";
import route from "../utils/route.js";
import { Circle } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// GET /circles — List viewer's own circles
router.get(
  "/",
  route(async ({ req, query, user, set, setStatus }) => {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip = (page - 1) * limit;

    const filter = { actorId: user.id, deletedAt: null };

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
    const base = `${protocol}://${domain}/circles`;

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
  })
);

router.get("/:id", id);
router.get("/:id/posts", posts);

// GET /circles/:id/members — list members of a circle (owner-only)
router.get(
  "/:id/members",
  route(async ({ req, params, query, user, set, setStatus }) => {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const circleId = decodeURIComponent(params.id);

    const circle = await Circle.findOne({
      id: circleId,
      deletedAt: null,
    })
      .select("id actorId members memberCount")
      .lean();

    if (!circle) {
      setStatus(404);
      set("error", "Circle not found");
      return;
    }

    if (circle.actorId !== user.id) {
      setStatus(403);
      set("error", "Access denied");
      return;
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip = (page - 1) * limit;

    const members = (circle.members || []).slice(skip, skip + limit);
    const total = circle.memberCount || (circle.members || []).length;

    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${domain}/circles/${encodeURIComponent(circleId)}/members`;

    const collection = activityStreamsCollection({
      id: `${base}?page=${page}`,
      orderedItems: members,
      totalItems: total,
      page,
      itemsPerPage: limit,
      baseUrl: base,
    });

    for (const [key, value] of Object.entries(collection)) {
      set(key, value);
    }
  })
);

export default router;
