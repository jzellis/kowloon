#!/usr/bin/env node
// Backfill summaries for existing Posts and their FeedItems cache entries.
// Only processes posts that have source.content but no summary yet.
//
// Usage:
//   node scripts/backfill-summaries.js              # dry run (shows counts only)
//   node scripts/backfill-summaries.js --write      # apply updates
//   node scripts/backfill-summaries.js --all        # re-generate all summaries, not just missing ones
//   node scripts/backfill-summaries.js --write --all

import "dotenv/config";
import mongoose from "mongoose";
import { generateSummary } from "../schema/Post.js";

// Minimal schemas so we can read/write without loading the full server stack
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
  console.log(ALL ? "Processing ALL posts with source content" : "Processing posts with missing summaries only");
  console.log("");

  // Build query
  const query = { "source.content": { $exists: true, $ne: "" } };
  if (!ALL) query.summary = { $exists: false };

  const posts = await RawPost.find(query).lean();
  console.log(`Found ${posts.length} posts to process`);

  let summaryAdded = 0;
  let summaryCleared = 0;
  let skipped = 0;
  let feedItemsUpdated = 0;

  for (const post of posts) {
    const summary = generateSummary(post.source);

    // No change needed
    if (summary === post.summary) {
      skipped++;
      continue;
    }

    if (summary) summaryAdded++;
    else summaryCleared++;

    if (!DRY_RUN) {
      // Update Post directly — skip pre-save hooks to avoid re-signing and other side effects
      await RawPost.updateOne(
        { _id: post._id },
        { $set: { summary: summary ?? null } }
      );

      // Update the matching FeedItem's cached object
      const feedResult = await RawFeedItem.updateOne(
        { id: post.id },
        { $set: { "object.summary": summary ?? null } }
      );
      if (feedResult.matchedCount > 0) feedItemsUpdated++;
    } else {
      // In dry-run mode, show what would happen
      const preview = summary
        ? summary.replace(/<[^>]+>/g, "").slice(0, 80).replace(/\s+/g, " ")
        : "(none — would be cleared)";
      console.log(`  ${post.id}`);
      console.log(`    summary → ${preview}${summary && summary.length > 80 ? "…" : ""}`);
    }
  }

  console.log("");
  console.log("Results:");
  console.log(`  Summaries added/updated : ${summaryAdded}`);
  console.log(`  Summaries cleared       : ${summaryCleared}`);
  console.log(`  No change needed        : ${skipped}`);
  if (!DRY_RUN) {
    console.log(`  FeedItems updated       : ${feedItemsUpdated}`);
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
