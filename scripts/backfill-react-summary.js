#!/usr/bin/env node
// Backfill Post.reactSummary (and FeedItems.object.reactSummary) for posts
// that have reactions but no cached summary yet.
//
// Usage:
//   node scripts/backfill-react-summary.js              # dry run
//   node scripts/backfill-react-summary.js --write
//   node scripts/backfill-react-summary.js --write --all  # rebuild all

import "dotenv/config";
import mongoose from "mongoose";

const PostSchema = new mongoose.Schema({}, { strict: false, collection: "posts" });
const ReactSchema = new mongoose.Schema({}, { strict: false, collection: "reacts" });
const FeedItemsSchema = new mongoose.Schema({}, { strict: false, collection: "feeditems" });
const RawPost = mongoose.model("RawPost", PostSchema);
const RawReact = mongoose.model("RawReact", ReactSchema);
const RawFeedItem = mongoose.model("RawFeedItem", FeedItemsSchema);

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--write");
const ALL = args.has("--all");

async function summaryFor(targetId) {
  const groups = await RawReact.aggregate([
    { $match: { target: targetId } },
    { $group: { _id: "$emoji", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  const emojis = groups.map((g) => g._id).filter(Boolean);
  return {
    top: emojis[0] ?? null,
    summary: emojis.length ? emojis.join("") : null,
  };
}

async function main() {
  const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://localhost:27017/kowloon";
  await mongoose.connect(mongoUrl);
  console.log(`Connected to MongoDB: ${mongoUrl}`);
  console.log(DRY_RUN ? "DRY RUN — pass --write to apply" : "WRITE MODE");

  const query = ALL
    ? { reactCount: { $gt: 0 } }
    : { reactCount: { $gt: 0 }, $or: [{ reactSummary: null }, { reactSummary: { $exists: false } }] };

  const posts = await RawPost.find(query, { id: 1, reactSummary: 1 }).lean();
  console.log(`Found ${posts.length} posts to process`);

  let updated = 0;
  let skipped = 0;

  for (const post of posts) {
    const { top, summary } = await summaryFor(post.id);
    if (summary === post.reactSummary) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  ${post.id}  →  ${summary ?? "(none)"}`);
      updated++;
      continue;
    }
    await RawPost.updateOne(
      { _id: post._id },
      { $set: { reactPreview: top, reactSummary: summary } }
    );
    await RawFeedItem.updateOne(
      { "object.id": post.id },
      { $set: { "object.reactPreview": top, "object.reactSummary": summary } }
    );
    updated++;
  }

  console.log("");
  console.log("Results:");
  console.log(`  Updated  : ${updated}`);
  console.log(`  Skipped  : ${skipped}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
