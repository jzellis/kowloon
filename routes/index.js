// /routes/index.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router({ mergeParams: true });

// --- helpers you already have ---
function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const routesRoot = __dirname;
const entries = fs.readdirSync(routesRoot, { withFileTypes: true });

// NEW: keep a registry of mounted routers for introspection
const mounted = []; // [{ name, mountPath, router }]

// Mount subfolders that have an index.js
for (const dirent of entries) {
  if (!dirent.isDirectory()) continue;

  const name = dirent.name; // e.g., "posts", "resolve", "users"
  const full = path.join(routesRoot, name);
  const indexJs = path.join(full, "index.js");

  if (name === "middleware" || name === "utils") {
    console.log(`routes: skip ${name} (utility)`);
    continue;
  }
  if (!isFile(indexJs)) {
    console.log(`routes: skip ${name} (no index.js)`);
    continue;
  }

  // "home" mounts at "/", everything else at "/<name>"
  const mountPath = name === "home" ? "/" : `/${name}`;

  try {
    const mod = await import(pathToFileURL(indexJs).href);
    const subrouter = mod.default || mod.router || mod;
    if (!subrouter || typeof subrouter !== "function") {
      console.warn(`routes: skip ${name} (default export is not a router)`);
      continue;
    }

    // Mount
    router.use(mountPath, subrouter);

    // Record for introspection
    mounted.push({ name, mountPath, router: subrouter });

    console.log(`routes: mounted ${mountPath}`);
  } catch (e) {
    console.error(`routes: failed to mount ${name}:`, e.message);
  }
}

// --- DEV-ONLY introspection endpoint ---
if (process.env.NODE_ENV !== "production") {
  // Convert Layer.regexp into a readable path segment (best-effort)
  const regexToPath = (layer) => {
    // Express fast_slash ("/")
    if (layer?.regexp?.fast_slash) return "";
    // Route layers will have route.path
    if (layer?.route?.path) return layer.route.path;

    // Try to decode the mount path from the regex (/:id/members style)
    const src = layer?.regexp?.source;
    if (!src) return "";
    // Unescape slashes and remove anchors
    let p = src.replace(/\\\//g, "/").replace(/^\^/, "").replace(/\$$/, "");

    // Replace path-to-regexp param patterns with :name when available
    // layer.keys contains param names in order
    if (Array.isArray(layer.keys) && layer.keys.length) {
      let i = 0;
      p = p
        // common non-greedy param fragment
        .replace(
          /\(\?:\(\[\^\\\/]\+\?\)\)/g,
          () => `:${layer.keys[i++]?.name || "param"}`
        )
        // fallback for other param encodings
        .replace(
          /\(\[\^\/]+\?\)/g,
          () => `:${layer.keys[i++]?.name || "param"}`
        );
    }

    // Trim trailing regex fragments like '/?(?=\/|$)'
    p = p.replace(/\/\?\(\?=\\\/\|\$\)/g, "").replace(/\/\?\(\?=\/\|\$\)/g, "");
    // Ensure it starts with "/" if it has content
    if (p && !p.startsWith("/")) p = "/" + p;
    return p;
  };

  // Recursively walk an express.Router and collect endpoints
  const walk = (rtr, base = "") => {
    const out = [];
    const stack = rtr?.stack || [];
    for (const layer of stack) {
      // Nested router via .use()
      if (layer.name === "router" && layer.handle && layer.handle.stack) {
        const seg = regexToPath(layer);
        const nextBase = (base + seg).replace(/\/+/g, "/");
        out.push({
          // type: "router",
          path: nextBase || "/",
          children: walk(layer.handle, nextBase),
        });
      }
      // Concrete route with HTTP methods
      else if (layer.route) {
        const routePath = (base + layer.route.path).replace(/\/+/g, "/") || "/";
        const methods = Object.keys(layer.route.methods || {})
          .filter(Boolean)
          .map((m) => m.toUpperCase());
        out.push({
          // type: "route",
          methods,
          path: routePath,
        });
      }
    }
    return out;
  };

  // Build a tree grouped by top-level directory mount
  const buildTree = () => {
    return mounted.map(({ name, mountPath, router: r }) => ({
      mount: mountPath,
      dir: name,
      tree: walk(r, mountPath === "/" ? "" : mountPath),
    }));
  };

  router.get("/__routes", (_req, res) => {
    const data = buildTree();
    res.json({ generatedAt: new Date().toISOString(), mounts: data });
  });
}

// Export the aggregate router
export default router;
