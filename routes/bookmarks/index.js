// routes/bookmarks/index.js
import express from "express";
import route from "../utils/route.js";
import getVisibleBookmarks from "#methods/get/visibleBookmarks.js";

const router = express.Router();

router.get(
  "/",
  route(async ({ req, query, set }) => {
    const { before, limit = 50, select } = query;
    const serverOwnerId = `@server@${process.env.DOMAIN}`;

    const { items, count, nextCursor } = await getVisibleBookmarks(
      "server",
      serverOwnerId,
      {
        viewerId: req.user?.id || null,
        before,
        limit: Number(limit),
        select,
      }
    );

    set("items", items);
    set("count", count);
    if (nextCursor) set("nextCursor", nextCursor);
  })
);

export default router;
