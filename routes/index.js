// /routes/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router({ mergeParams: true });

// Record mounted subrouters for listing later
const mounted = [];

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

// ---------------------------------------------------------------------------
// dynamic route mounting
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
    mounted.push({ mountPath, subrouter }); // record for listing
    console.log(`routes: mounted ${mountPath}`);
  } catch (e) {
    console.error(`routes: failed to mount ${name}:`, e.message);
  }
}

// ---------------------------------------------------------------------------
// Route listing utilities (no regex parsing of layer.regexp)

function joinPaths(a = "", b = "") {
  const s = `${a}${b}`;
  const n = s.replace(/\/+/g, "/");
  return n !== "/" ? n.replace(/\/$/, "") : "/";
}

function addRoute(out, seen, methods, path) {
  const keyBase = `${path}`;
  for (const m of methods) {
    const key = `${m} ${keyBase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ methods: [m], path });
  }
}

function collectFromRouter(prefix, rtr, out, seen) {
  const stack = rtr && rtr.stack;
  if (!Array.isArray(stack)) return;

  for (const layer of stack) {
    if (layer && layer.route) {
      const rawPath = layer.route.path; // string or array
      const methods = Object.keys(layer.route.methods || {}).map((m) =>
        m.toUpperCase()
      );

      if (Array.isArray(rawPath)) {
        for (const p of rawPath) {
          addRoute(out, seen, methods, joinPaths(prefix, p));
        }
      } else {
        addRoute(out, seen, methods, joinPaths(prefix, rawPath));
      }
    } else if (
      layer &&
      layer.name === "router" &&
      layer.handle &&
      layer.handle.stack
    ) {
      // nested router; recurse with same prefix (child paths are relative)
      collectFromRouter(prefix, layer.handle, out, seen);
    }
  }
}

function listAllRoutes() {
  const out = [];
  const seen = new Set();

  for (const { mountPath, subrouter } of mounted) {
    collectFromRouter(mountPath === "/" ? "" : mountPath, subrouter, out, seen);
  }

  // Sort for readability
  out.sort(
    (a, b) =>
      a.path.localeCompare(b.path) || a.methods[0].localeCompare(b.methods[0])
  );
  return out;
}

// GET /__routes -> JSON list of all routes (skip listing __routes itself)
router.get("/__routes", (_req, res) => {
  const routes = listAllRoutes().filter((r) => r.path !== "/__routes");
  res.json({ total: routes.length, routes });
});

// Optional: log at boot
if (process.env.ROUTE_DEBUG) {
  const routes = listAllRoutes();
  console.log(`Loaded ${routes.length} routes:`);
  for (const r of routes) console.log(`${r.methods[0].padEnd(6)} ${r.path}`);
}

export default router;
