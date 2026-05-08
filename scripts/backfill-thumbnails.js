#!/usr/bin/env node
// Backfill thumbnails for existing image File records that don't have them.
// For each image without thumbnails, downloads the original from storage,
// generates 200/400 webp thumbnails, uploads them, and writes the keys back
// to the File record.
//
// Usage:
//   node scripts/backfill-thumbnails.js              # dry run (counts only)
//   node scripts/backfill-thumbnails.js --write      # apply
//   node scripts/backfill-thumbnails.js --write --limit 50

import "dotenv/config";
import mongoose from "mongoose";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getStorageAdapter } from "../methods/files/index.js";
import { generateThumbnails, isImageMimeType } from "../methods/files/thumbnail.js";

const FileSchema = new mongoose.Schema({}, { strict: false, collection: "files" });
const RawFile = mongoose.model("RawFile", FileSchema);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--write");
const FORCE = args.includes("--force");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 0;
const SIZES = [200, 400];
const CACHE_CONTROL = "private, max-age=31536000, immutable";

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  const mongoUrl = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://localhost:27017/kowloon";
  await mongoose.connect(mongoUrl);
  console.log(`Connected to MongoDB: ${mongoUrl}`);
  console.log(DRY_RUN ? "DRY RUN — pass --write to apply changes" : "WRITE MODE");

  const storage = await getStorageAdapter();

  const query = FORCE
    ? { type: "Image", storageKey: { $exists: true, $ne: null }, deletedAt: null }
    : {
        type: "Image",
        storageKey: { $exists: true, $ne: null },
        $or: [{ thumbnails: null }, { thumbnails: { $exists: false } }],
        deletedAt: null,
      };

  const files = LIMIT > 0
    ? await RawFile.find(query).limit(LIMIT).lean()
    : await RawFile.find(query).lean();

  console.log(`Found ${files.length} image files without thumbnails`);
  console.log("");

  let processed = 0;
  let skipped = 0;
  let errored = 0;

  for (const file of files) {
    if (!isImageMimeType(file.mediaType)) {
      skipped++;
      continue;
    }

    try {
      if (DRY_RUN) {
        console.log(`  ${file.id}  [${file.mediaType}]  ${file.storageKey}`);
        processed++;
        continue;
      }

      const stream = await storage.getStream(file.storageKey);
      const buffer = await streamToBuffer(stream);
      const thumbBuffers = await generateThumbnails(buffer, SIZES);

      const thumbKeys = {};
      for (const [size, thumbBuffer] of Object.entries(thumbBuffers)) {
        const thumbKey = `thumbnails/${file.storageKey.replace(/\.[^.]+$/, "")}_${size}.webp`;
        await storage.client.send(
          new PutObjectCommand({
            Bucket: storage.bucket,
            Key: thumbKey,
            Body: thumbBuffer,
            ContentType: "image/webp",
            CacheControl: CACHE_CONTROL,
            ACL: "private",
          })
        );
        thumbKeys[size] = thumbKey;
      }

      await RawFile.updateOne({ _id: file._id }, { $set: { thumbnails: thumbKeys } });
      processed++;
      if (processed % 10 === 0) console.log(`  Processed ${processed}/${files.length}…`);
    } catch (err) {
      errored++;
      console.error(`  Error on ${file.id}: ${err.message}`);
    }
  }

  console.log("");
  console.log("Results:");
  console.log(`  Processed : ${processed}`);
  console.log(`  Skipped   : ${skipped}`);
  console.log(`  Errored   : ${errored}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
