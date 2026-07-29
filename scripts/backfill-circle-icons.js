#!/usr/bin/env node
// Backfill auto-generated mosaic icons for existing user Circles that don't
// have a creator-supplied icon. Idempotent — regenerateCircleIcon self-guards
// (local type:"Circle" only, never overwrites a custom icon, needs >=1 member
// with a usable avatar).
//
// Usage:
//   node scripts/backfill-circle-icons.js            # dry run (counts only)
//   node scripts/backfill-circle-icons.js --write     # apply
//   node scripts/backfill-circle-icons.js --write --limit 50

import "dotenv/config";
import mongoose from "mongoose";
import { Circle, Settings } from "#schema";
import { loadSettings } from "#methods/settings/cache.js";
import regenerateCircleIcon from "#methods/circles/regenerateCircleIcon.js";

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--write");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const PLACEHOLDER_RE = /\/images\/(circle|user|group)\.svg(\?.*)?$/i;

async function main() {
  const mongoUrl =
    process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://localhost:27017/kowloon";
  await mongoose.connect(mongoUrl);
  await loadSettings(Settings);
  console.log(`Connected: ${mongoUrl}`);
  console.log(DRY_RUN ? "DRY RUN — pass --write to apply" : "WRITE MODE");

  // Candidates: user circles with at least one member whose icon is unset,
  // the placeholder, or already auto-generated.
  const query = {
    type: "Circle",
    "members.0": { $exists: true },
    $or: [
      { icon: { $in: [null, undefined, ""] } },
      { icon: { $regex: PLACEHOLDER_RE } },
      { iconGenerated: true },
    ],
  };
  const cursor = Circle.find(query).select("id name").lean().cursor();

  let seen = 0, done = 0, skipped = 0;
  for (let c = await cursor.next(); c != null; c = await cursor.next()) {
    seen++;
    if (LIMIT && done >= LIMIT) break;
    if (DRY_RUN) {
      console.log(`  would regenerate: ${c.id}  (${c.name || "unnamed"})`);
      continue;
    }
    const res = await regenerateCircleIcon(c.id);
    if (res.ok) {
      done++;
      console.log(`  ok: ${c.id} -> ${res.icon}  (${res.members} members)`);
    } else {
      skipped++;
      console.log(`  skip: ${c.id}  (${res.reason})`);
    }
  }

  console.log(
    DRY_RUN
      ? `\nDry run: ${seen} candidate circle(s).`
      : `\nDone: ${done} regenerated, ${skipped} skipped, ${seen} scanned.`
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
