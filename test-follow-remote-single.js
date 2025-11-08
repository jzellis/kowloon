#!/usr/bin/env node
// Test: Follow a single remote user and verify profile data is fetched
import "dotenv/config";
import mongoose from "mongoose";
import { User, Circle } from "./schema/index.js";
import FollowHandler from "./ActivityParser/handlers/Follow/index.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/kowloon";

async function test() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected!\n");

    // Get admin user
    const admin = await User.findOne({ username: "admin" })
      .select("id username following")
      .lean();

    if (!admin) {
      throw new Error("Admin user not found");
    }
    console.log(`👤 Admin: ${admin.id}\n`);

    // Test following a remote user
    const testUserId = "@admin@kwln.social";
    console.log(`➕ Following ${testUserId}...\n`);

    const activity = {
      type: "Follow",
      actorId: admin.id,
      object: testUserId,
      target: admin.following,
      createdAt: new Date(),
    };

    const result = await FollowHandler(activity);

    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`✅ Result: ${result.result?.status}`);
    }

    // Check the circle member
    console.log("\n📊 Checking circle member data...");
    const circle = await Circle.findOne({ id: admin.following })
      .select("members")
      .lean();

    const member = circle.members?.find(m => m.id === testUserId);
    if (member) {
      console.log("\n✅ Member found:");
      console.log(`   ID: ${member.id}`);
      console.log(`   Name: ${member.name || '(none)'}`);
      console.log(`   Icon: ${member.icon || '(none)'}`);
      console.log(`   Inbox: ${member.inbox || '(none)'}`);
      console.log(`   Outbox: ${member.outbox || '(none)'}`);
      console.log(`   URL: ${member.url || '(none)'}`);
    } else {
      console.log("❌ Member not found in circle");
    }

    await mongoose.disconnect();
    console.log("\n✅ Test complete!");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Fatal error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

test();
