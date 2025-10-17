// /routes/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router({ mergeParams: true });

// --- parse JSON EARLY (so route wrapper sees req.body) ----------------------
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
      // also allow vendor types that end with +json
      if (ct.endsWith("+json")) return true;
      return false;
    },
  })
);

// Optional: urlencoded (harmless, helps some tools)
router.use(express.urlencoded({ extended: false, limit: JSON_LIMIT }));

// --- request logging (endpoint + querystring) -------------------------------
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

// --- helpers you already have ----------------------------------------------
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const routesRoot = __dirname;
const entries = fs.readdirSync(routesRoot, { withFileTypes: true });
const mounted = [];

// Mount subrouters (folders with index.js)
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
    if (!subrouter || typeof subrouter !== "function") {
      console.warn(`routes: skip ${name} (default export is not a router)`);
      continue;
    }
    router.use(mountPath, subrouter);
    mounted.push({ name, mountPath, router: subrouter });
    console.log(`routes: mounted ${mountPath}`);
  } catch (e) {
    console.error(`routes: failed to mount ${name}:`, e.message);
  }
}

// Dev-only introspection (unchanged)
if (process.env.NODE_ENV !== "production") {
  const regexToPath = (layer) => {
    if (layer?.regexp?.fast_slash) return "";
    if (layer?.route?.path) return layer.route.path;
    const src = layer?.regexp?.source;
    if (!src) return "";
    let p = src.replace(/\\\//g, "/").replace(/^\^/, "").replace(/\$$/, "");
    if (Array.isArray(layer.keys) && layer.keys.length) {
      let i = 0;
      p = p
        .replace(
          /\(\?:\(\[\^\\\/]\+\?\)\)/g,
          () => `:${layer.keys[i++]?.name || "param"}`
        )
        .replace(
          /\(\[\^\/]+\?\)/g,
          () => `:${layer.keys[i++]?.name || "param"}`
        );
    }
    p = p.replace(/\/\?\(\?=\\\/\|\$\)/g, "").replace(/\/\?\(\?=\/\|\$\)/g, "");
    if (p && !p.startsWith("/")) p = "/" + p;
    return p;
  };
  const walk = (rtr, base = "") => {
    const out = [];
    const stack = rtr?.stack || [];
    for (const layer of stack) {
      if (layer.name === "router" && layer.handle && layer.handle.stack) {
        const seg = regexToPath(layer);
        const nextBase = (base + seg).replace(/\/+/g, "/");
        out.push({
          path: nextBase || "/",
          children: walk(layer.handle, nextBase),
        });
      } else if (layer.route) {
        const routePath = (base + layer.route.path).replace(/\/+/g, "/") || "/";
        const methods = Object.keys(layer.route.methods || {}).map((m) =>
          m.toUpperCase()
        );
        out.push({ methods, path: routePath });
      }
    }
    return out;
  };
  const buildTree = () =>
    mounted.map(({ name, mountPath, router: r }) => ({
      mount: mountPath,
      dir: name,
      tree: walk(r, mountPath === "/" ? "" : mountPath),
    }));
  router.get("/__routes", (_req, res) => {
    res.json({ generatedAt: new Date().toISOString(), mounts: buildTree() });
  });
}

export default router;
