// scripts/wipe.js
import "dotenv/config";
import Kowloon, { attachMethodDomains } from "#kowloon";
import initKowloon from "#methods/utils/init.js";
import * as Models from "#schema/index.js";

// usage:
//   node scripts/wipe.js --runId dev1
//   node scripts/wipe.js --runId dev1 --force   (skip confirmation)

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v === undefined ? true : isNaN(+v) ? v : +v];
  })
);

const RUN_ID = args.runId;
if (!RUN_ID) {
  console.error("❌ You must pass --runId=<id> to wipe a seeded run.");
  process.exit(1);
}

// Ask confirmation unless --force passed
if (!args.force) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise((resolve) => {
    rl.question(
      `⚠️  This will permanently delete all documents with meta.runId="${RUN_ID}". Continue? (y/N) `,
      resolve
    );
  });
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log("Aborted.");
    process.exit(0);
  }
}

async function main() {
  console.log(`→ Connecting to DB to wipe runId="${RUN_ID}"...`);
  await initKowloon(Kowloon, {
    domain: process.env.DOMAIN || undefined,
    siteTitle: process.env.SITE_TITLE || "Kowloon",
  });
  await attachMethodDomains(Kowloon);

  const { User, Post, Reply, React, Page, Bookmark, Event, Group, Circle } =
    Models;

  const collections = {
    User,
    Post,
    Reply,
    React,
    Page,
    Bookmark,
    Event,
    Group,
    Circle,
  };
  const counts = {};

  for (const [name, Model] of Object.entries(collections)) {
    const res = await Model.deleteMany({ "meta.runId": RUN_ID });
    counts[name] = res.deletedCount || 0;
  }

  console.log("\n🧹 Wipe complete.");
  console.table(counts);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Wipe failed:", err);
  process.exit(1);
});
