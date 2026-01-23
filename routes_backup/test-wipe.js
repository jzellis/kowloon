// /routes/test-wipe.js
// **TESTING ONLY** - Wipe database endpoint for test environments
// Remove this file in production!

import route from "./utils/route.js";
import mongoose from "mongoose";

export default route(async ({ req, set, setStatus }) => {
  // Safety check: Only allow in non-production environments
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    setStatus(403);
    set("error", "Database wipe is disabled in production");
    return;
  }

  // No authentication required in test environments for automated tests
  // (Production check above ensures this can't be abused)

  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    const KEEP = new Set(["settings"]); // Keep settings collection
    const results = [];

    for (const { name } of collections) {
      if (name.startsWith("system.")) {
        results.push({ collection: name, status: "skipped", reason: "system collection" });
        continue;
      }
      if (KEEP.has(name)) {
        results.push({ collection: name, status: "kept" });
        continue;
      }

      const coll = db.collection(name);
      const { deletedCount } = await coll.deleteMany({});
      results.push({ collection: name, status: "wiped", deletedCount });
    }

    set("success", true);
    set("results", results);
    set("message", "Database wiped successfully (kept settings)");
  } catch (err) {
    setStatus(500);
    set("error", err.message);
  }
}, { allowUnauth: true });
