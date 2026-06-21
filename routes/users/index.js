import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import lookup from "./lookup.js";
import search from "./search.js";
import actor from "./actor.js";
import posts from "./posts.js";
import circles from "./circles.js";
import bookmarks from "./bookmarks.js";
import activities from "./activities.js";
import notifications from "./notifications.js";
import inboxPost from "../inbox/post.js";
import { FeedItems } from "#schema";
import feedItemToPost from "#methods/feed/feedItemToPost.js";
import { getSetting } from "#methods/settings/cache.js";
import { toRSS } from "#methods/rss/index.js";

const router = express.Router({ mergeParams: true });
import Kowloon from "#kowloon";

const STATIC_SEGMENTS = new Set(["lookup", "search"]);

router.param("id", async (req, _res, next, val) => {
  if (STATIC_SEGMENTS.has(val)) return next();
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
router.get("/search", search);
router.get("/:id", (req, res, next) => {
  if (isApRequest(req)) return actor(req, res, next);
  const accept = req.headers.accept || ''
  if (accept.includes('text/html')) return next('router')
  next();
}, id);
router.get("/:id/posts", async (req, res, next) => {
  if (!("rss" in req.query)) return next();
  const domain = getSetting("domain");
  const userId = req.params.id;
  const docs = await FeedItems.find({ actorId: userId, to: "public", tombstoned: { $ne: true }, objectType: "Post" })
    .sort({ publishedAt: -1 }).limit(20).lean();
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${domain}`;
  const handle = userId.replace(/^@/, "");
  const xml = toRSS(docs.map(feedItemToPost), {
    title: `${handle} on ${domain}`,
    link: `${base}/users/${encodeURIComponent(userId)}`,
    feedLink: `${base}/users/${encodeURIComponent(userId)}/posts?rss`,
    description: `Public posts by ${handle}`,
    domain,
  });
  res.set("Content-Type", "text/xml; charset=UTF-8").send(xml);
}, posts);
router.get("/:id/circles", circles);
router.get("/:id/bookmarks", bookmarks);
router.get("/:id/activities", activities);
router.use("/:id/notifications", notifications);
// Per-user inbox: accepts inbound federation POSTs (e.g. from remote servers)
router.post("/:id/inbox", inboxPost);

export default router;
