import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import lookup from "./lookup.js";
import actor from "./actor.js";
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

// AP content negotiation: serve actor JSON when client requests ActivityPub
function isApRequest(req) {
  const accept = req.headers.accept || "";
  return (
    accept.includes("application/activity+json") ||
    accept.includes('application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
  );
}

router.get("/", collection);
router.get("/lookup", lookup);
router.get("/:id", (req, res, next) => {
  if (isApRequest(req)) return actor(req, res, next);
  next();
}, id);
router.get("/:id/posts", posts);
router.get("/:id/circles", circles);
router.get("/:id/bookmarks", bookmarks);
router.get("/:id/activities", activities);
router.use("/:id/notifications", notifications);
// Per-user inbox: accepts inbound federation POSTs (e.g. from remote servers)
router.post("/:id/inbox", inboxPost);

export default router;
