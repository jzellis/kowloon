#!/usr/bin/env node
// Test: Manually trigger federation pull from remote servers
import "dotenv/config";
import mongoose from "mongoose";
import pullFromServer from "./methods/federation/pullFromServer.js";
import Settings from "./schema/Settings.js";
import { loadSettings } from "./methods/settings/cache.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO_URL || "mongodb://127.0.0.1:27017/kowloon";

async function main() {
  console.log("🔌 Connecting to database...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected");

  console.log("📥 Loading settings...");
  await loadSettings(Settings);
  console.log("✅ Settings loaded\n");

  const domains = ["kwln.social", "kowloon.network"];

  for (const domain of domains) {
    console.log(`${"=".repeat(60)}`);
    console.log(`📡 Pulling from ${domain}`);
    console.log("=".repeat(60));

    try {
      const result = await pullFromServer(domain, { limit: 100 });

      if (result.error) {
        console.error(`❌ Error: ${result.error}`);
        if (result.details) {
          console.error(`   Details: ${result.details}`);
        }
      } else {
        console.log(`✅ Pull completed`);
        console.log(`   Ingested: ${result.result?.ingested || 0} items`);
        console.log(`   Filtered: ${result.result?.filtered || 0} items`);
        console.log(
          `   Requested from: ${result.requested?.include?.join(", ") || "none"}`
        );
        console.log(
          `   Cursors present: ${result.next?.cursorsPresent?.join(", ") || "none"}`
        );
      }
    } catch (err) {
      console.error(`❌ Exception pulling from ${domain}:`, err.message);
    }

    console.log();
  }

  console.log(`${"=".repeat(60)}`);
  console.log("✅ Manual pull test complete!");
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
