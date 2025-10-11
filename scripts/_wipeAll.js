// scripts/wipe_all.js
import "dotenv/config";
import Kowloon, { attachMethodDomains } from "#kowloon";
import initKowloon from "#methods/utils/init.js";
import * as Models from "#schema/index.js";

// Usage:
//   node scripts/wipe_all.js
//   node scripts/wipe_all.js --force

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : isNaN(+v) ? v : +v];
  })
);

async function confirmOrExit() {
  if (args.force) return;
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) => {
    rl.question(
      "⚠️  This will DELETE all data except Settings and the admin user. Continue? (y/N) ",
      resolve
    );
  });
  rl.close();
  if (!/^y(es)?$/i.test(String(answer).trim())) {
    console.log("Aborted.");
    process.exit(0);
  }
}

async function main() {
  await confirmOrExit();

  console.log("→ Connecting to DB...");
  await initKowloon(Kowloon, {
    domain: process.env.DOMAIN || undefined,
    siteTitle: process.env.SITE_TITLE || "Kowloon",
  });
  await attachMethodDomains(Kowloon);

  const {
    Settings,
    User,
    Bookmark,
    Circle,
    Event,
    Group,
    Page,
    Post,
    React,
    Reply,
    // add other models here if your schema index exports them
  } = Models;

  // Find the admin user — prefer username "admin", fallback to first created user
  let adminUser = await User.findOne({ username: "admin" }).lean();
  if (!adminUser) {
    adminUser = await User.findOne({}).sort({ createdAt: 1 }).lean();
  }
  if (!adminUser) {
    console.error("❌ No users found. Nothing to preserve.");
  } else {
    console.log(`→ Preserving user: ${adminUser.username || adminUser.id}`);
  }

  // Build deletion ops:
  const ops = [];

  // Wipe all except Settings and the preserved admin user
  if (adminUser?._id) {
    ops.push(User.deleteMany({ _id: { $ne: adminUser._id } }));
  } else {
    // No users present; safe to wipe all users (though it's already empty)
    ops.push(User.deleteMany({}));
  }

  // Collections to fully wipe
  const wipeCollections = [
    Bookmark,
    Circle,
    Event,
    Group,
    Page,
    Post,
    React,
    Reply,
  ].filter(Boolean);

  for (const Model of wipeCollections) {
    ops.push(Model.deleteMany({}));
  }

  // Execute
  console.log("→ Wiping collections (except Settings and admin)...");
  const results = await Promise.allSettled(ops);

  // Pretty print results
  const summary = {};
  let i = 0;
  if (adminUser) {
    summary["User (others)"] =
      results[i]?.status === "fulfilled"
        ? results[i]?.value?.deletedCount ?? "ok"
        : "error";
    i += 1;
  } else {
    summary["User (all)"] =
      results[i]?.status === "fulfilled"
        ? results[i]?.value?.deletedCount ?? "ok"
        : "error";
    i += 1;
  }
  for (const Model of wipeCollections) {
    const label = Model?.modelName || "Unknown";
    summary[label] =
      results[i]?.status === "fulfilled"
        ? results[i]?.value?.deletedCount ?? "ok"
        : "error";
    i += 1;
  }

  console.log("\n🧹 Wipe-all complete (Settings preserved).");
  console.table(summary);

  // Health check
  const settingsCount = await Settings.countDocuments();
  console.log(`Settings remaining: ${settingsCount}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Wipe-all failed:", err);
  process.exit(1);
});
