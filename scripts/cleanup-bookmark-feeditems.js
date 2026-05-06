#!/usr/bin/env node
// Remove FeedItems with objectType "Bookmark" — bookmarks no longer fan out
// to feeds. Also clears any FeedFanOut grants that point at bookmark items
// so the per-user feed tables stay tidy.
//
// Usage:
//   MONGO_URI=... node scripts/cleanup-bookmark-feeditems.js [--dry-run]

import mongoose from "mongoose";
import { FeedItems } from "../schema/index.js";

const DRY_RUN = process.argv.includes("--dry-run");
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI env var.");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const itemsCount = await FeedItems.countDocuments({ objectType: "Bookmark" });
  const itemIds = itemsCount > 0
    ? (await FeedItems.find({ objectType: "Bookmark" }).select("id").lean()).map((d) => d.id)
    : [];

  let fanOutCount = 0;
  if (itemIds.length) {
    const FeedFanOut = mongoose.connection.collection("feedfanouts");
    fanOutCount = await FeedFanOut.countDocuments({ feedItemId: { $in: itemIds } });
  }

  console.log(`Bookmark FeedItems: ${itemsCount}`);
  console.log(`FeedFanOut grants pointing at bookmark items: ${fanOutCount}`);

  if (itemsCount === 0) {
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: no changes written.");
    await mongoose.disconnect();
    return;
  }

  const itemRes = await FeedItems.deleteMany({ objectType: "Bookmark" });
  console.log(`Deleted ${itemRes.deletedCount} bookmark FeedItems.`);

  if (itemIds.length) {
    const FeedFanOut = mongoose.connection.collection("feedfanouts");
    const fanRes = await FeedFanOut.deleteMany({ feedItemId: { $in: itemIds } });
    console.log(`Deleted ${fanRes.deletedCount} FeedFanOut grants.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
