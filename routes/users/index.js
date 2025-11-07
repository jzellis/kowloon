import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import replies from "#routes/replies/index.js";
import reacts from "#routes/reacts/index.js";
import bookmarks from "./bookmarks.js";
import posts from "./posts.js";
import circles from "./circles.js";
import events from "./events.js";
import groups from "./groups.js";
import inbox from "#routes/inbox/index.js";
const router = express.Router({ mergeParams: true });
import Kowloon from "#kowloon";

router.param("id", async (req, _res, next, val) => {
  if (!val.includes("@") && req.method === "GET") {
    const domain = Kowloon.settings.domain;
    if (domain) req.params.id = `@${val}@${domain}`;
  }
  next();
});

router.get("/", collection);
router.get("/:id", id);
router.use("/:id/replies", replies);
router.use("/:id/reacts", reacts);
router.get("/:id/bookmarks", bookmarks);
router.get("/:id/posts", posts);
router.get("/:id/circles", circles);
router.get("/:id/events", events);
router.get("/:id/groups", groups);
router.get("/:id/inbox", inbox);

export default router;
