// /index.js
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import nocache from "nocache";
import http from "http";

import Kowloon, { attachMethodDomains } from "#kowloon";
// Connect DB & load settings BEFORE loading method domains, to avoid buffering timeouts.
import initKowloon from "#methods/utils/init.js";

// 1) Connect DB + load settings/admin
await initKowloon(Kowloon, {
  domain: process.env.DOMAIN || undefined,
  siteTitle: process.env.SITE_TITLE || "Kowloon",
  adminEmail: process.env.ADMIN_EMAIL || undefined,
  smtpHost: process.env.SMTP_HOST || undefined,
  smtpUser: process.env.SMTP_USER || undefined,
  smtpPass: process.env.SMTP_PASS || undefined,
});

// 2) Now load methods (safe: DB is up)
// await attachMethodDomains(Kowloon);

// 3) Build Express
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

// 4) Import and mount your existing aggregate router AFTER DB + methods are ready
const routes = (await import("#routes/index.js")).default;
app.use("/", routes);

// Health
app.get("/__health", (_req, res) => {
  const ready =
    !!Kowloon?.mongoose && Kowloon.mongoose.connection?.readyState === 1;
  res.json({
    ok: ready,
    readyState: Kowloon.mongoose?.connection?.readyState ?? -1,
  });
});

// Start HTTP
const port = Number(process.env.PORT || 3000);
http.createServer(app).listen(port, "0.0.0.0", () => {
  console.log(`HTTP listening on :${port}`);
});
export default Kowloon;
