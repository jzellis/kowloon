import express from "express";
import collection from "./collection.js";
import server from "./server.js";
import id from "./id.js";
import replies from "./replies.js";
import reacts from "./reacts.js";
import { FeedItems } from "#schema";
import feedItemToPost from "#methods/feed/feedItemToPost.js";
import { getSetting } from "#methods/settings/cache.js";
import { toRSS } from "#methods/rss/index.js";

const router = express.Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  if (!("rss" in req.query)) return next();
  const domain = getSetting("domain");
  const siteName = getSetting("siteName") || "Kowloon";
  const docs = await FeedItems.find({ to: "public", tombstoned: { $ne: true }, objectType: "Post" })
    .sort({ publishedAt: -1 }).limit(20).lean();
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${domain}`;
  const xml = toRSS(docs.map(feedItemToPost), {
    title: `${siteName} — Public Posts`,
    link: `${base}/`,
    feedLink: `${base}/posts?rss`,
    description: `Public posts from ${siteName}`,
    domain,
  });
  res.set("Content-Type", "application/rss+xml").send(xml);
}, collection);
router.get("/server", server);
router.get("/:id", id);
router.get("/:id/replies", replies);
router.get("/:id/reacts", reacts);

export default router;
