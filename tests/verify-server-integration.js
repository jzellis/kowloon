// Verification script for Follow/Unfollow Server integration with reference counting
import FollowHandler from "../ActivityParser/handlers/Follow/index.js";
import UnfollowHandler from "../ActivityParser/handlers/Unfollow/index.js";
import { User, Circle, Server } from "../schema/index.js";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function verify() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/kowloon-test");

    console.log("\n=== Testing Follow Handler with Server Reference Counting ===\n");

    // Create two test users
    const testUser1 = await User.findOneAndUpdate(
      { username: "testuser1" },
      {
        $setOnInsert: {
          id: `@testuser1@${process.env.DOMAIN || "kwln.org"}`,
          username: "testuser1",
          actorId: `https://${process.env.DOMAIN || "kwln.org"}/users/testuser1`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const testUser2 = await User.findOneAndUpdate(
      { username: "testuser2" },
      {
        $setOnInsert: {
          id: `@testuser2@${process.env.DOMAIN || "kwln.org"}`,
          username: "testuser2",
          actorId: `https://${process.env.DOMAIN || "kwln.org"}/users/testuser2`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Create Following circles for both users
    const circle1 = await Circle.findOneAndUpdate(
      { "owner.id": testUser1.id, subtype: "Following" },
      {
        $setOnInsert: {
          id: `circle:following-${testUser1.username}@${process.env.DOMAIN || "kwln.org"}`,
          name: "Following",
          subtype: "Following",
          owner: { id: testUser1.id, name: testUser1.name || testUser1.username },
          members: [],
          memberCount: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const circle2 = await Circle.findOneAndUpdate(
      { "owner.id": testUser2.id, subtype: "Following" },
      {
        $setOnInsert: {
          id: `circle:following-${testUser2.username}@${process.env.DOMAIN || "kwln.org"}`,
          name: "Following",
          subtype: "Following",
          owner: { id: testUser2.id, name: testUser2.name || testUser2.username },
          members: [],
          memberCount: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`Created test users: ${testUser1.id}, ${testUser2.id}`);

    // Test 1: First user follows remote actor
    const remoteUser = "@alice@remote.example.com";
    console.log(`\n--- Test 1: User 1 follows ${remoteUser} ---`);

    await FollowHandler({
      actorId: testUser1.id,
      object: remoteUser,
      target: circle1.id,
    });

    let server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
    });

    const count1 = server?.actorsRefCount?.get(remoteUser);
    console.log(count1 === 1 ? "✓ Refcount correctly set to 1" : `✗ Expected 1, got ${count1}`);
    console.log(server?.include?.actors ? "✓ include.actors is true" : "✗ include.actors should be true");

    // Test 2: Second user follows same remote actor
    console.log(`\n--- Test 2: User 2 also follows ${remoteUser} ---`);

    await FollowHandler({
      actorId: testUser2.id,
      object: remoteUser,
      target: circle2.id,
    });

    server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
    });

    const count2 = server?.actorsRefCount?.get(remoteUser);
    console.log(count2 === 2 ? "✓ Refcount correctly incremented to 2" : `✗ Expected 2, got ${count2}`);

    // Test 3: Follow the server itself
    console.log(`\n--- Test 3: User 1 follows @remote.example.com (server) ---`);

    await FollowHandler({
      actorId: testUser1.id,
      object: "@remote.example.com",
      target: circle1.id,
    });

    server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
    });

    console.log(
      server?.serverFollowersCount === 1
        ? "✓ serverFollowersCount correctly set to 1"
        : `✗ Expected 1, got ${server?.serverFollowersCount}`
    );
    console.log(server?.include?.public ? "✓ include.public is true" : "✗ include.public should be true");

    // Test 4: First user unfollows remote actor
    console.log(`\n--- Test 4: User 1 unfollows ${remoteUser} ---`);

    await UnfollowHandler({
      actorId: testUser1.id,
      object: remoteUser,
      target: circle1.id,
    });

    server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
    });

    const count3 = server?.actorsRefCount?.get(remoteUser);
    console.log(count3 === 1 ? "✓ Refcount correctly decremented to 1" : `✗ Expected 1, got ${count3}`);

    // Test 5: Second user unfollows (count should reach 0 and remove key)
    console.log(`\n--- Test 5: User 2 unfollows ${remoteUser} (should remove key) ---`);

    await UnfollowHandler({
      actorId: testUser2.id,
      object: remoteUser,
      target: circle2.id,
    });

    server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
    });

    const hasKey = server?.actorsRefCount?.has(remoteUser);
    console.log(!hasKey ? "✓ Actor key correctly removed at count 0" : "✗ Actor key should be removed");
    console.log(server?.include?.actors === false ? "✓ include.actors is false" : "✗ include.actors should be false");

    // Test 6: Unfollow server (should pause polling)
    console.log(`\n--- Test 6: User 1 unfollows @remote.example.com ---`);

    await UnfollowHandler({
      actorId: testUser1.id,
      object: "@remote.example.com",
      target: circle1.id,
    });

    server = await Server.findOne({ domain: "remote.example.com" });
    console.log("Server state:", {
      actorsRefCount: server?.actorsRefCount ? Object.fromEntries(server.actorsRefCount) : {},
      serverFollowersCount: server?.serverFollowersCount,
      include: server?.include,
      nextPollAt: server?.scheduler?.nextPollAt,
    });

    console.log(
      server?.serverFollowersCount === 0
        ? "✓ serverFollowersCount correctly decremented to 0"
        : `✗ Expected 0, got ${server?.serverFollowersCount}`
    );
    console.log(
      server?.include?.public === false ? "✓ include.public is false" : "✗ include.public should be false"
    );

    console.log("\n=== All Tests Complete ===\n");

    // Cleanup
    await User.deleteOne({ id: testUser1.id });
    await User.deleteOne({ id: testUser2.id });
    await Circle.deleteOne({ id: circle1.id });
    await Circle.deleteOne({ id: circle2.id });
    await Server.deleteOne({ domain: "remote.example.com" });

  } catch (error) {
    console.error("Verification failed:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

verify();
