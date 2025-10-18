// /routes/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router({ mergeParams: true });

// --- parse JSON early -------------------------------------------------------
const JSON_LIMIT = process.env.JSON_LIMIT || "2mb";
const jsonTypes = [
  "application/json",
  "application/activity+json",
  "application/ld+json",
  "text/json",
  "text/activity+json",
];
router.use(
  express.json({
    limit: JSON_LIMIT,
    type: (req) => {
      const ct = (req.headers["content-type"] || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ct) return false;
      if (jsonTypes.includes(ct)) return true;
      if (ct.endsWith("+json")) return true;
      return false;
    },
  })
);
router.use(express.urlencoded({ extended: false, limit: JSON_LIMIT }));

// --- request logging ---------------------------------------------------------
const API_LOG =
  /^(1|true|yes)$/i.test(process.env.API_LOG || "") ||
  process.env.NODE_ENV === "development";

router.use((req, _res, next) => {
  if (API_LOG) {
    const url = req.originalUrl || req.url || "";
    const [pathname, qs] = url.split("?", 2);
    console.log(`API ${req.method} ${pathname}${qs ? `?${qs}` : ""}`);
  }
  next();
});

// === NEW: attach req.user from Authorization: Bearer <token> ================
// Tries your own auth helpers if present; otherwise falls back to JWT verify.
router.use(async (req, _res, next) => {
  if (req.user && req.user.id) return next();

  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return next();
  const token = m[1];

  // Try your project methods first (optional imports; won't throw if missing)
  try {
    // 1) whoami(token) -> { id, ... }
    try {
      const mod = await import("#methods/auth/whoami.js");
      const whoami = mod?.default || mod?.whoami || mod;
      if (typeof whoami === "function") {
        const u = await whoami(token);
        if (u && u.id) {
          req.user = { id: u.id, ...u };
          if (API_LOG) console.log(`API auth user (whoami): ${req.user.id}`);
          return next();
        }
      }
    } catch {}

    // 2) verify(token) -> { id, ... }
    try {
      const mod = await import("#methods/auth/verify.js");
      const verify = mod?.default || mod?.verify || mod;
      if (typeof verify === "function") {
        const u = await verify(token);
        if (u && u.id) {
          req.user = { id: u.id, ...u };
          if (API_LOG) console.log(`API auth user (verify): ${req.user.id}`);
          return next();
        }
      }
    } catch {}

    // 3) fallback: decode JWT if available
    try {
      const jwtMod = await import("jsonwebtoken");
      const getSettingsMod = await import("#methods/settings/get.js");
      const getSettings = getSettingsMod?.default || getSettingsMod;

      const settings =
        typeof getSettings === "function"
          ? await getSettings().catch(() => ({}))
          : {};
      const secret =
        settings?.jwtSecret ||
        settings?.jwt?.secret ||
        process.env.JWT_SECRET ||
        process.env.JWT_KEY;

      if (secret && jwtMod?.verify) {
        const payload = jwtMod.verify(token, secret);
        const id = payload?.id || payload?.sub || payload?.actorId;
        if (id) {
          req.user = { id };
          if (API_LOG) console.log(`API auth user (jwt): ${req.user.id}`);
        }
      }
    } catch {
      // ignore JWT errors; req.user stays undefined
    }
  } catch {
    // never block the request on auth attach
  }
  next();
});

// ---------------------------------------------------------------------------
// existing dynamic route mounting (unchanged)
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}
const routesRoot = __dirname;
const entries = fs.readdirSync(routesRoot, { withFileTypes: true });

for (const dirent of entries) {
  if (!dirent.isDirectory()) continue;
  const name = dirent.name;
  if (name === "middleware" || name === "utils") {
    console.log(`routes: skip ${name} (utility)`);
    continue;
  }
  const indexJs = path.join(routesRoot, name, "index.js");
  if (!isFile(indexJs)) {
    console.log(`routes: skip ${name} (no index.js)`);
    continue;
  }
  const mountPath = name === "home" ? "/" : `/${name}`;
  try {
    const mod = await import(pathToFileURL(indexJs).href);
    const subrouter = mod.default || mod.router || mod;
    if (typeof subrouter !== "function") {
      console.warn(`routes: skip ${name} (default export is not a router)`);
      continue;
    }
    router.use(mountPath, subrouter);
    console.log(`routes: mounted ${mountPath}`);
  } catch (e) {
    console.error(`routes: failed to mount ${name}:`, e.message);
  }
}

export default router;
