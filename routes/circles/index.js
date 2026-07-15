// routes/circles/index.js
// Circle endpoints. GET /circles lists all circles visible to the viewer
// (discovery); a user's own circles are GET /users/:my-id/circles.

import express from "express";
import id from "./id.js";
import posts from "./posts.js";
import collection from "./collection.js";
import route from "../utils/route.js";
import { Circle } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

// GET /circles — local circles visible to the viewer (discovery), sortable via
// ?sort=. "Mine" is GET /users/:my-id/circles.
router.get("/", collection);
router.get("/:id", id);
router.get("/:id/posts", posts);

// PATCH /circles/:id/seen — update the high-water mark for this circle's feed
router.patch(
  "/:id/seen",
  route(async ({ params, body, user, set, setStatus }) => {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const circleId = decodeURIComponent(params.id);
    const circle = await Circle.findOne({ id: circleId, deletedAt: null })
      .select("id actorId lastSeenAt")
      .lean();

    if (!circle) {
      setStatus(404);
      set("error", "Circle not found");
      return;
    }

    if (circle.actorId !== user.id) {
      setStatus(403);
      set("error", "Only the circle owner can update seen state");
      return;
    }

    const incoming = body?.lastSeenAt ? new Date(body.lastSeenAt) : null;
    if (!incoming || isNaN(incoming.getTime())) {
      setStatus(400);
      set("error", "lastSeenAt must be a valid ISO date string");
      return;
    }

    // Only advance the mark — never move it backwards
    const current = circle.lastSeenAt ? new Date(circle.lastSeenAt) : null;
    if (current && incoming <= current) {
      set("ok", true);
      set("lastSeenAt", circle.lastSeenAt);
      return;
    }

    await Circle.updateOne({ id: circleId }, { $set: { lastSeenAt: incoming } });
    set("ok", true);
    set("lastSeenAt", incoming);
  })
);

// GET /circles/:id/members — list members of a circle (authorized users)
router.get(
  "/:id/members",
  route(async ({ req, params, query, user, set, setStatus }) => {
    const circleId = decodeURIComponent(params.id);

    const circle = await Circle.findOne({
      id: circleId,
      deletedAt: null,
    })
      .select("id actorId members memberCount to")
      .lean();

    if (!circle) {
      setStatus(404);
      set("error", "Circle not found");
      return;
    }

    const domain = getSetting("domain") || "";
    const to = circle.to || "";
    const isPublic = to === "@public" || to === "public";
    const isServerVisible = to === `@${domain}` || to === "@server" || to === "server";
    const isOwner = user?.id && circle.actorId === user?.id;
    const isMember = user?.id && circle.members?.some((m) => m.id === user?.id);

    if (!isPublic) {
      if (!user?.id) {
        setStatus(401);
        set("error", "Authentication required");
        return;
      }
      if (!isOwner && !isMember && !isServerVisible) {
        setStatus(403);
        set("error", "Access denied");
        return;
      }
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip = (page - 1) * limit;

    const members = (circle.members || []).slice(skip, skip + limit);
    const total = circle.memberCount || (circle.members || []).length;

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
