// /routes/index.js (excerpt)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

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

// Mount subfolders that have an index.js
for (const dirent of entries) {
  if (!dirent.isDirectory()) continue;

  const name = dirent.name; // e.g., "posts", "resolve", "users"
  const full = path.join(routesRoot, name);
  const indexJs = path.join(full, "index.js");

  // Skip known non-route dirs
  if (name === "middleware" || name === "utils") {
    console.log(`routes: skip ${name} (utility)`);
    continue;
  }

  if (!isFile(indexJs)) {
    console.log(`routes: skip ${name} (no index.js)`);
    continue;
  }

  // Build mount path - "home" mounts at "/", everything else at "/<name>"
  const mountPath = name === "home" ? "/" : `/${name}`;

  try {
    const mod = await import(pathToFileURL(indexJs).href);
    const subrouter = mod.default || mod.router || mod;
    if (!subrouter || typeof subrouter !== "function") {
      console.warn(`routes: skip ${name} (default export is not a router)`);
      continue;
    }
    router.use(mountPath, subrouter);
    console.log(`routes: mounted ${mountPath}`);
  } catch (e) {
    console.error(`routes: failed to mount ${name}:`, e.message);
  }
}

// If you also allow top-level files (e.g., /routes/well-known.js), keep your existing logic for those.

// Export the aggregate router
export default router;
