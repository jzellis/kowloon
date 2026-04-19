// /index.js
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import nocache from "nocache";
import http from "http";

import Kowloon, { attachMethodDomains } from "#kowloon";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Connect DB & load settings BEFORE loading method domains, to avoid buffering timeouts.
import initKowloon from "#methods/utils/init.js";

// 1) Validate required config in production
if (process.env.NODE_ENV === "production" && !process.env.DOMAIN) {
  console.error(
    "ERROR: DOMAIN is not set. Run the Kowloon installer first, or set DOMAIN in your .env file."
  );
  process.exit(1);
}

// 2) Connect DB + load settings/admin
await initKowloon(Kowloon, {
  domain: process.env.DOMAIN || undefined,
  siteTitle: process.env.SITE_TITLE || "Kowloon",
  adminEmail: process.env.ADMIN_EMAIL || undefined,
  adminUsername: process.env.ADMIN_USERNAME || undefined,
  adminDisplayName: process.env.ADMIN_DISPLAY_NAME || undefined,
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  smtpHost: process.env.SMTP_HOST || undefined,
  smtpPort: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
  smtpUser: process.env.SMTP_USER || undefined,
  smtpPass: process.env.SMTP_PASS || undefined,
});

// 3) Now load methods (safe: DB is up)
// await attachMethodDomains(Kowloon);

// 4) Build Express
const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
app.use(nocache());

// Make Kowloon available to routes
app.locals.Kowloon = Kowloon;
app.use((req, _res, next) => {
  req.Kowloon = Kowloon;
  next();
});

// 5) SEO middleware — intercept crawler/scraper requests before API routes
const { default: botMiddleware } = await import("#methods/seo/botDetect.js");
app.use(botMiddleware);

// 5a) robots.txt + sitemap.xml
const { generateRobots } = await import("#methods/seo/robots.js");
const { generateSitemap } = await import("#methods/seo/sitemap.js");
app.get("/robots.txt", (req, res) => {
  res.set("Content-Type", "text/plain").send(generateRobots(req));
});
app.get("/sitemap.xml", async (req, res) => {
  const xml = await generateSitemap(req);
  res.set("Content-Type", "application/xml").send(xml);
});

// 6) Import and mount your existing aggregate router AFTER DB + methods are ready
const routes = (await import("#routes/index.js")).default;
app.use("/", routes);

// 7) Serve built frontend (if present) — after API routes so they take priority
const publicDir = join(__dirname, "public");
if (existsSync(publicDir) && process.env.SERVE_FRONTEND !== "false") {
  const { default: serveStatic } = await import("serve-static");
  app.use(serveStatic(publicDir, { maxAge: "1y", immutable: true, index: false }));
  // SPA fallback — any unmatched route serves index.html
  app.get("*", (_req, res) => res.sendFile(join(publicDir, "index.html")));
}

// Health (both paths — /health is conventional, /__health kept for compat)
function healthHandler(_req, res) {
  const ready =
    !!Kowloon?.mongoose && Kowloon.mongoose.connection?.readyState === 1;
  res.json({
    ok: ready,
    readyState: Kowloon.mongoose?.connection?.readyState ?? -1,
  });
}
app.get("/health",   healthHandler);
app.get("/__health", healthHandler);

// Start HTTP
const port = Number(process.env.PORT || 3000);
http.createServer(app).listen(port, "0.0.0.0", () => {
  console.log(`HTTP listening on :${port}`);
});

// Start outbox worker for federation (outbound delivery)
try {
  const { startOutboxWorker } = await import(
    "#methods/federation/outboxWorker.js"
  );
  const workerInterval = Number(process.env.OUTBOX_WORKER_INTERVAL || 5000);
  startOutboxWorker(workerInterval);
} catch (err) {
  console.error("Failed to start outbox worker:", err.message);
}

// Start poll worker for federation (inbound pull from remote servers)
try {
  const { startPollWorker } = await import(
    "#methods/federation/pollWorker.js"
  );
  const pollInterval = Number(process.env.POLL_WORKER_INTERVAL || 30_000);
  startPollWorker(pollInterval);
} catch (err) {
  console.error("Failed to start poll worker:", err.message);
}

export default Kowloon;
