// methods/seo/botDetect.js
// Express middleware — intercepts crawler/scraper requests for known frontend
// routes and returns a meta-tag HTML shell instead of the SPA or JSON API.

import { fetchMeta } from "./meta.js";
import { renderShell } from "./shell.js";

const BOT_RE = /Googlebot|bingbot|Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Discordbot|TelegramBot|iframely|Embedly|rogerbot|redditbot|applebot|Pinterestbot|DuckDuckBot/i;

const FRONTEND_PATHS = [
  /^\/$/,
  /^\/posts\/.+/,
  /^\/users\/.+/,
  /^\/groups\/.+/,
  /^\/pages\/.+/,
];

export default async function botMiddleware(req, res, next) {
  const ua = req.headers["user-agent"] || "";
  if (!BOT_RE.test(ua)) return next();

  const path = req.path;
  if (!FRONTEND_PATHS.some((re) => re.test(path))) return next();

  try {
    const meta = await fetchMeta(path, req);
    const html = renderShell(meta);
    res.set("Content-Type", "text/html").send(html);
  } catch (err) {
    next(); // on error, fall through to normal handling
  }
}
