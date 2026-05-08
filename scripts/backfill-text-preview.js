#!/usr/bin/env node
// Backfill textPreview for existing Posts and their FeedItems cache entries.
// By default, processes posts that have source.content but no textPreview yet.
//
// Usage:
//   node scripts/backfill-text-preview.js              # dry run
//   node scripts/backfill-text-preview.js --write      # apply updates
//   node scripts/backfill-text-preview.js --all        # re-generate all previews
//   node scripts/backfill-text-preview.js --write --all

import "dotenv/config";
import mongoose from "mongoose";
import { generateTextPreview } from "../schema/Post.js";

const PostSchema = new mongoose.Schema({}, { strict: false, collection: "posts" });
const FeedItemsSchema = new mongoose.Schema({}, { strict: false, collection: "feeditems" });
const RawPost = mongoose.model("RawPost", PostSchema);
const RawFeedItem = mongoose.model("RawFeedItem", FeedItemsSchema);

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has("--write");
const ALL = args.has("--all");

async function main() {
  const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://localhost:27017/kowloon";
  await mongoose.connect(mongoUrl);
  console.log(`Connected to MongoDB: ${mongoUrl}`);
  console.log(DRY_RUN ? "DRY RUN — pass --write to apply changes" : "WRITE MODE");
  console.log(ALL ? "Processing ALL posts with source content" : "Processing posts with missing textPreview only");
  console.log("");

  const query = { "source.content": { $exists: true, $ne: "" } };
  if (!ALL) query.textPreview = { $exists: false };

  const posts = await RawPost.find(query).lean();
  console.log(`Found ${posts.length} posts to process`);

  let added = 0;
  let cleared = 0;
  let skipped = 0;
  let feedItemsUpdated = 0;

  for (const post of posts) {
    const textPreview = generateTextPreview(post.source);

    if (textPreview === post.textPreview) {
      skipped++;
      continue;
    }

    if (textPreview) added++;
    else cleared++;

    if (!DRY_RUN) {
      await RawPost.updateOne(
        { _id: post._id },
        textPreview
          ? { $set: { textPreview } }
          : { $unset: { textPreview: "" } }
      );

      const feedResult = await RawFeedItem.updateOne(
        { id: post.id },
        textPreview
          ? { $set: { "object.textPreview": textPreview } }
          : { $unset: { "object.textPreview": "" } }
      );
      if (feedResult.matchedCount > 0) feedItemsUpdated++;
    } else {
      const display = textPreview ?? "(none — would be cleared)";
      console.log(`  ${post.id}`);
      console.log(`    textPreview → ${display}`);
    }
  }

  console.log("");
  console.log("Results:");
  console.log(`  textPreview added/updated : ${added}`);
  console.log(`  textPreview cleared       : ${cleared}`);
  console.log(`  No change needed          : ${skipped}`);
  if (!DRY_RUN) {
    console.log(`  FeedItems updated         : ${feedItemsUpdated}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
