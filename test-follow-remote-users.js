#!/usr/bin/env node
// Test: Add remote users from kwln.social and kowloon.network to admin's following circle
import "dotenv/config";
import mongoose from "mongoose";
import { User, Circle } from "./schema/index.js";
import FollowHandler from "./ActivityParser/handlers/Follow/index.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/kowloon";

const remoteServers = ["kwln.social", "kowloon.network"];

async function fetchRemoteUsers(domain) {
  try {
    const url = `https://${domain}/users`;
    console.log(`  Fetching ${url}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract user IDs from orderedItems
    const items = data.orderedItems || [];
    const userIds = items.map(item => typeof item === 'string' ? item : item.id).filter(Boolean);
    console.log(`  ✅ Found ${userIds.length} users`);

    return userIds;
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    return [];
  }
}

async function test() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected!\n");

    // Get admin user
    console.log("👤 Finding admin user...");
    const admin = await User.findOne({ username: "admin" })
      .select("id username following")
      .lean();

    if (!admin) {
      throw new Error("Admin user not found");
    }
    console.log(`✅ Found: ${admin.id}\n`);

    // Get admin's following circle
    console.log("📋 Finding admin's following circle...");
    const followingCircle = await Circle.findOne({
      id: admin.following
    }).select("id members").lean();

    if (!followingCircle) {
      throw new Error("Following circle not found");
    }
    console.log(`✅ Following circle: ${followingCircle.id}`);
    console.log(`   Current members: ${followingCircle.members?.length || 0}\n`);

    // Fetch users from remote servers
    console.log("🌐 Fetching users from remote servers...\n");
    const allRemoteUsers = [];

    for (const domain of remoteServers) {
      console.log(`📡 ${domain}:`);
      const users = await fetchRemoteUsers(domain);
      allRemoteUsers.push(...users);
      console.log();
    }

    if (allRemoteUsers.length === 0) {
      console.log("⚠️  No remote users found. Exiting.");
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`📊 Total remote users found: ${allRemoteUsers.length}\n`);

    // Follow each remote user
    console.log("➕ Following remote users...\n");
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const remoteUserId of allRemoteUsers) {
      try {
        console.log(`  Following ${remoteUserId}...`);

        // Create Follow activity with explicit target circle
        const activity = {
          type: "Follow",
          actorId: admin.id,
          object: remoteUserId,
          target: admin.following, // Explicitly specify the following circle
          createdAt: new Date(),
        };

        const result = await FollowHandler(activity);

        if (result.error) {
          console.log(`  ❌ Error: ${result.error}`);
          errorCount++;
        } else if (result.result?.status === "followed") {
          console.log(`  ✅ Followed successfully`);
          successCount++;
        } else if (result.result?.status === "already_following") {
          console.log(`  ⏭️  Already following`);
          skipCount++;
        } else {
          console.log(`  ⚠️  Unknown result: ${JSON.stringify(result)}`);
        }
      } catch (err) {
        console.log(`  ❌ Exception: ${err.message}`);
        errorCount++;
      }
    }

    // Get updated circle info
    console.log("\n📊 Checking updated following circle...");
    const updatedCircle = await Circle.findOne({
      id: admin.following
    }).select("id members memberCount").lean();

    console.log(`   Total members: ${updatedCircle.memberCount || updatedCircle.members?.length || 0}`);

    if (updatedCircle.members && updatedCircle.members.length > 0) {
      console.log(`\n   Members:`);
      for (const member of updatedCircle.members) {
        console.log(`   - ${member.id || member}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully followed: ${successCount}`);
    console.log(`   ⏭️  Already following: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log("=".repeat(60));

    await mongoose.disconnect();
    console.log("\n✅ Test complete!");
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ Fatal error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

test();
