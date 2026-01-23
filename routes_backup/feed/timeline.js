// /routes/feed/timeline.js
// GET /feed/timeline
// Unified timeline endpoint that assembles from Feed, FeedItems, and remote pulls

import route from "../utils/route.js";
import Kowloon from "#kowloon";
import logger from "#methods/utils/logger.js";

export default route(async (api) => {
  const { req, user, setStatus, set } = api;

  // Require authentication
  if (!user?.id) {
    setStatus(401);
    set({ error: "Authentication required" });
    return;
  }

  // Parse query parameters
  const circleId = req.query.circle || req.query.circleId;
  const types = req.query.types ? String(req.query.types).split(',').map(s => s.trim()).filter(Boolean) : [];
  const since = req.query.since;
  const limit = Math.min(Number(req.query.limit) || 50, 500);

  // Require circleId
  if (!circleId) {
    setStatus(400);
    set({ error: "circleId parameter is required" });
    return;
  }

  logger.info("feed/timeline: Request", {
    user: user.id,
    circleId,
    types: types.length,
    since,
    limit,
  });

  try {
    const result = await Kowloon.feed.getTimeline({
      viewerId: user.id,
      circleId,
      types,
      since,
      limit,
    });

    setStatus(200);
    set({
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      totalItems: result.items.length,
      orderedItems: result.items,
      ...(result.nextCursor && {
        next: result.nextCursor,
      }),
    });
  } catch (error) {
    logger.error("feed/timeline: Error", {
      user: user.id,
      error: error.message,
      stack: error.stack,
    });
    setStatus(500);
    set({ error: "Internal server error" });
  }
});
