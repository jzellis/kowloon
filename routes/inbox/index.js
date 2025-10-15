// /routes/inbox/index.js
import express from "express";
import route from "../utils/route.js";
import getFeed from "#methods/inbox/getFeed.js";
import post from "./post.js";

const router = express.Router({ mergeParams: true });

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

    set({ items, count, nextCursor });
  })
);

// Attach the POST route for inbound federation
router.post("/", post);

export default router;
