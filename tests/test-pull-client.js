// /tests/test-pull-client.js
// Example test/demo script for POST /federation/pull/:domain client route

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Server, User, Circle } from "../schema/index.js";
import fetch from "node-fetch";

dotenv.config();

const API_BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/kowloon-test";

async function setup() {
  console.log("Setting up test data...\n");

  await mongoose.connect(MONGO_URI);

  // Create a test Server entry for remote.example.com
  const server = await Server.findOneAndUpdate(
    { domain: "remote.example.com" },
    {
      $setOnInsert: {
        id: "@remote.example.com",
        domain: "remote.example.com",
        outbox: "https://remote.example.com/outbox/pull",
        supports: {
          signedPull: false, // Set true if remote requires JWT
          compression: true,
        },
        include: {
          public: true,
          actors: true,
          audience: true,
        },
        actorsRefCount: new Map([
          ["@alice@remote.example.com", 2],
          ["@bob@remote.example.com", 1],
        ]),
        serverFollowersCount: 1,
        scheduler: {
          nextPollAt: new Date(),
          backoffMs: 0,
          errorCount: 0,
        },
        stats: {
          itemsSeen: 0,
          notModifiedHits: 0,
        },
        timeouts: {
          connectMs: 10000,
          readMs: 30000,
        },
        maxPage: 100,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✓ Created Server record: ${server.domain}`);
  console.log(`  actorsRefCount:`, Object.fromEntries(server.actorsRefCount || new Map()));
  console.log(`  serverFollowersCount:`, server.serverFollowersCount);
  console.log(`  include:`, server.include);

  // Create test local users
  const testUser1 = await User.findOneAndUpdate(
    { username: "localuser1" },
    {
      $setOnInsert: {
        id: `@localuser1@${process.env.DOMAIN || "kwln.org"}`,
        username: "localuser1",
        actorId: `https://${process.env.DOMAIN || "kwln.org"}/users/localuser1`,
      },
    },
    { upsert: true, new: true }
  );

  // Create Following circle with remote actors
  await Circle.findOneAndUpdate(
    { "owner.id": testUser1.id, subtype: "Following" },
    {
      $setOnInsert: {
        id: `circle:following-localuser1@${process.env.DOMAIN || "kwln.org"}`,
        name: "Following",
        subtype: "Following",
        owner: { id: testUser1.id, name: "localuser1" },
        members: [
          { id: "@alice@remote.example.com", name: "Alice" },
          { id: "@remote.example.com", name: "Remote Server" },
        ],
        memberCount: 2,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`✓ Created local user: ${testUser1.id}`);
  console.log(`  Following: @alice@remote.example.com, @remote.example.com\n`);

  return { server, testUser1 };
}

async function testPullRequest(authToken) {
  console.log("=== Testing POST /federation/pull/:domain ===\n");

  const response = await fetch(`${API_BASE}/federation/pull/remote.example.com`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`, // Required by route
    },
    body: JSON.stringify({
      limit: 50,
      filters: {
        objectTypes: ["Post", "Reply"],
      },
    }),
  });

  console.log(`Response status: ${response.status}`);

  const data = await response.json();
  console.log("Response body:");
  console.log(JSON.stringify(data, null, 2));

  return data;
}

async function cleanup() {
  console.log("\n=== Cleanup ===\n");

  await Server.deleteOne({ domain: "remote.example.com" });
  await User.deleteOne({ username: "localuser1" });
  await Circle.deleteOne({
    subtype: "Following",
    "owner.id": `@localuser1@${process.env.DOMAIN || "kwln.org"}`,
  });

  console.log("✓ Cleaned up test data");

  await mongoose.disconnect();
}

async function run() {
  try {
    const { server, testUser1 } = await setup();

    // Note: You need a valid JWT token for your local user
    // This is just a placeholder - replace with actual token generation
    const authToken = process.env.TEST_JWT_TOKEN || "YOUR_JWT_TOKEN_HERE";

    if (authToken === "YOUR_JWT_TOKEN_HERE") {
      console.log("⚠️  No TEST_JWT_TOKEN provided in environment");
      console.log("   Set TEST_JWT_TOKEN to test the authenticated endpoint\n");
    } else {
      await testPullRequest(authToken);
    }

    await cleanup();
  } catch (error) {
    console.error("Test failed:", error);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

export { setup, testPullRequest, cleanup };
