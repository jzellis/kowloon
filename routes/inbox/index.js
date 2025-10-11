// routes/inbox/index.js
import express from "express";
import route from "../utils/route.js";
import getFeed from "#methods/inbox/getFeed.js";
// import parseIncomingActivity from "#ActivityParser/index.js";
const router = express.Router();

/**
 * GET /inbox
 * Query: ?before=<ISO>&limit=50&types=post,event (comma-separated)
 * Requires auth: only the logged-in user can view their own inbox.
 */
router.get(
  "/",
  route(async ({ req, query, set, setStatus }) => {
    const viewerId = req.user?.id;
    if (!viewerId) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const types =
      typeof query.types === "string"
        ? query.types
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const { items, count, nextCursor } = await getFeed(viewerId, {
      before: query.before,
      limit: query.limit ? Number(query.limit) : 50,
      types,
      includeSelf: query.includeSelf !== "false", // default true
    });

    set("items", items);
    set("count", count);
    if (nextCursor) set("nextCursor", nextCursor);
  })
);

router.post("/", async (req, res) => {
  const ctx = {
    targetUserId: req.params?.id || null,
    requestMeta: { headers: req.headers, rawBody: req.rawBody, ip: req.ip },
    db: req.app.locals.db,
    queues: req.app.locals.queues,
    federation: req.app.locals.federation,
    logger: req.app.locals.logger,
    domain: process.env.DOMAIN,
    baseUrl: `https://${process.env.DOMAIN}`,
  };

  // const result = await parseIncomingActivity(req.body, ctx);
  res.status(202).json({ id: result.activity.id, status: "accepted" });
});

export default router;
