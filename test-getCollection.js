#!/usr/bin/env node
import "dotenv/config";
import mongoose from "mongoose";
import getCollection from "./methods/collections/getCollection.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/kowloon";

async function test() {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected!");

    // Test getCollection
    console.log("\nTesting getCollection with type='Post', no auth...");
    const result = await getCollection({
      type: "Post",
      objectType: undefined,
      actorId: undefined,
      limit: 5,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: -1,
      filters: {},
    });

    console.log("\nResult:");
    console.log(`- Total: ${result.total}`);
    console.log(`- Items returned: ${result.items.length}`);
    console.log(`- Has more: ${result.hasMore}`);

    if (result.items.length > 0) {
      console.log("\nFirst item:");
      const first = result.items[0];
      console.log(`- ID: ${first.id}`);
      console.log(`- ActorId: ${first.actorId}`);
      console.log(`- ObjectType: ${first.objectType}`);
      console.log(`- Type: ${first.type}`);
      console.log(`- To: ${first.to}`);
      console.log(`- PublishedAt: ${first.publishedAt}`);
      console.log(`- Has object: ${!!first.object}`);
      console.log(`- Visibility flags:`, first._visibility);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

test();
