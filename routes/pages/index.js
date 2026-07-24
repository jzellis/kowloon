// routes/pages/index.js

import express from "express";
import collection from "./collection.js";
import id from "./id.js";

const router = express.Router({ mergeParams: true });

// If a browser navigates directly to a page URL, serve the SPA so React Router
// can render it (via the app's "*" index.html fallback). ActivityPub clients
// (application/activity+json) and programmatic fetches (*/*) still get the JSON
// API. Crawlers are handled by botDetect.js upstream. Mirrors routes/posts.
function wantsHTML(req) {
  const accept = req.headers.accept || "";
  if (accept.includes("application/activity+json")) return false;
  if (accept.includes("application/ld+json")) return false;
  return accept.includes("text/html");
}

router.get("/", collection);
router.get("/:id", (req, res, next) => (wantsHTML(req) ? next("router") : id(req, res, next)));

export default router;
