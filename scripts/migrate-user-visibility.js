#!/usr/bin/env node
// Coerce all User.to values to either "@public" or "@<own-domain>".
// Anything else (legacy circle/group/user IDs) becomes "@<own-domain>" — the
// safer default, since the user previously chose a restricted audience.
//
// Usage:
//   MONGO_URI=... node scripts/migrate-user-visibility.js [--dry-run]

import mongoose from "mongoose";
import { User } from "../schema/index.js";

const DRY_RUN = process.argv.includes("--dry-run");
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI env var.");
  process.exit(1);
}

function deriveDomain(user) {
  if (user.domain) return user.domain;
  if (typeof user.id === "string" && user.id.includes("@")) {
    return user.id.split("@").pop();
  }
  return null;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const users = await User.find({}).select("id to domain").lean();

  let publicCount = 0;
  let serverCount = 0;
  let coercedCount = 0;
  let skippedCount = 0;
  const updates = [];

  for (const u of users) {
    const to = u.to;
    const domain = deriveDomain(u);
    if (!domain) {
      console.warn(`[skip] ${u.id}: no resolvable domain`);
      skippedCount++;
      continue;
    }
    const serverTo = `@${domain}`;

    if (to === "@public") {
      publicCount++;
      continue;
    }
    if (to === serverTo) {
      serverCount++;
      continue;
    }

    // Anything else → coerce to server-only.
    coercedCount++;
    updates.push({ id: u.id, from: to, to: serverTo });
  }

  console.log(`Inspected ${users.length} users:`);
  console.log(`  @public:   ${publicCount}`);
  console.log(`  @<server>: ${serverCount}`);
  console.log(`  to coerce: ${coercedCount}`);
  console.log(`  skipped:   ${skippedCount}`);

  if (coercedCount === 0) {
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: no changes written. Sample of coercions:");
    for (const u of updates.slice(0, 10)) {
      console.log(`  ${u.id}: ${JSON.stringify(u.from)} -> ${u.to}`);
    }
    await mongoose.disconnect();
    return;
  }

  for (const u of updates) {
    await User.updateOne({ id: u.id }, { $set: { to: u.to } });
  }
  console.log(`Coerced ${coercedCount} users to server-only visibility.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
