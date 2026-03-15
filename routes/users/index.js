import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import posts from "./posts.js";
import circles from "./circles.js";
import bookmarks from "./bookmarks.js";
import activities from "./activities.js";
import notifications from "./notifications.js";
import inboxPost from "../inbox/post.js";

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
router.get("/:id/posts", posts);
router.get("/:id/circles", circles);
router.get("/:id/bookmarks", bookmarks);
router.get("/:id/activities", activities);
router.use("/:id/notifications", notifications);
// Per-user inbox: accepts inbound federation POSTs (e.g. from remote servers)
router.post("/:id/inbox", inboxPost);

export default router;
