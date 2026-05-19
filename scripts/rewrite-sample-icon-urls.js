// scripts/rewrite-sample-icon-urls.js
//
// Rewrite seeded sample-icons URLs from one host to another. Useful when the
// seed pipeline embedded `http://localhost:3000/sample-icons/...` but you
// access the server from a different machine (Tailscale, LAN, phone) and
// localhost doesn't resolve.
//
// Usage:
//   FROM=http://localhost:3000 TO=http://100.83.23.39:3000 \
//   MONGO_URI=mongodb://localhost:27018/kowloon \
//   node scripts/rewrite-sample-icon-urls.js
//
// Optional:
//   DRY_RUN=1   Show match counts without writing.

import "dotenv/config";
import mongoose from "mongoose";
import {
  Post, Reply, Page, User, Circle, Group, FeedItems, Bookmark,
} from "#schema";

const FROM = process.env.FROM;
const TO = process.env.TO;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!FROM || !TO) {
  console.error("Set FROM and TO env vars (e.g. FROM=http://localhost:3000 TO=http://100.83.23.39:3000).");
  process.exit(1);
}

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI env var.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);

const FROM_RE = new RegExp(FROM.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");

// Walk an object/array and rewrite any string values containing FROM.
function rewriteValue(val) {
  if (typeof val === "string") {
    return val.includes(FROM) ? val.replace(FROM_RE, TO) : val;
  }
  if (Array.isArray(val)) return val.map(rewriteValue);
  if (val && typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = rewriteValue(v);
    return out;
  }
  return val;
}

async function rewriteCollection(Model, label) {
  let scanned = 0;
  let updated = 0;
  const cursor = Model.find({}).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    scanned++;
    const json = doc.toObject();
    const rewritten = rewriteValue(json);
    if (JSON.stringify(json) === JSON.stringify(rewritten)) continue;
    updated++;
    if (!DRY_RUN) {
      // Re-apply field-by-field so Mongoose marks them modified.
      for (const [k, v] of Object.entries(rewritten)) {
        if (k === "_id" || k === "__v") continue;
        doc[k] = v;
      }
      await doc.save({ validateBeforeSave: false });
    }
  }
  console.log(`${label}: scanned ${scanned}, ${DRY_RUN ? "would update" : "updated"} ${updated}`);
}

console.log(DRY_RUN ? `DRY RUN: ${FROM} → ${TO}` : `Rewriting ${FROM} → ${TO}`);

await rewriteCollection(Post, "Post");
await rewriteCollection(Reply, "Reply");
await rewriteCollection(Page, "Page");
await rewriteCollection(User, "User");
await rewriteCollection(Circle, "Circle");
await rewriteCollection(Group, "Group");
await rewriteCollection(Bookmark, "Bookmark");
await rewriteCollection(FeedItems, "FeedItems");

await mongoose.disconnect();
console.log("\nDone.");
