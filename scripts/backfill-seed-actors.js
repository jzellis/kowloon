// scripts/backfill-seed-actors.js
//
// Rescues content created by seed.js, which writes Posts/Replies/Pages
// directly via Model.create() and so skips two pipeline side effects:
//   1. The `actor` subdoc isn't populated (only actorId is set).
//   2. No FeedItems row is written, so /posts, /circles/:id/posts, and
//      /groups/:id/posts return nothing for these objects.
//
// Pass this script over a freshly seed.js-populated DB and seeded posts
// become visible and properly attributed. Idempotent: skips any doc that
// already has actor + a matching FeedItems row, so re-running is cheap
// and running it after seed-extra.js (which already does it right via
// HTTP/outbox) is a no-op for those records.
//
// Usage:
//   MONGO_URI=mongodb://localhost:27018/kowloon node scripts/backfill-seed-actors.js
//
// Optional:
//   DRY_RUN=1   List what would change without writing.

import "dotenv/config";
import mongoose from "mongoose";
import Kowloon, { attachMethodDomains } from "#kowloon";
import initKowloon from "#methods/utils/init.js";
import { Post, Reply, Page, User, FeedItems } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import writeFeedItems from "#methods/feed/writeFeedItems.js";

const DRY_RUN = process.env.DRY_RUN === "1";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI env var.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
await initKowloon();
await attachMethodDomains(Kowloon);

const { domain } = getServerSettings();

// Build an Actor subdoc the same way ActivityParser/handlers/Create does.
function actorFromUser(user) {
  return {
    id: user.id,
    type: user.type ?? "Person",
    name: user.profile?.name ?? user.username,
    icon: user.profile?.icon ?? null,
    url: user.url ?? `https://${domain}/users/${user.id}`,
    inbox: user.inbox,
    outbox: user.outbox,
    server: user.server ?? `@${domain}`,
  };
}

const userCache = new Map();
async function getActor(actorId) {
  if (!actorId) return null;
  if (userCache.has(actorId)) return userCache.get(actorId);
  const user = await User.findOne({ id: actorId })
    .select("id username type profile url inbox outbox server")
    .lean();
  const actor = user ? actorFromUser(user) : null;
  userCache.set(actorId, actor);
  return actor;
}

async function backfillModel(Model, objectType) {
  const docs = await Model.find({}).lean();
  let actorFilled = 0;
  let feedItemsWritten = 0;
  let skipped = 0;

  for (const doc of docs) {
    const needsActor = !doc.actor?.id;
    const needsFeedItem = !(await FeedItems.exists({ id: doc.id }));

    if (!needsActor && !needsFeedItem) {
      skipped++;
      continue;
    }

    let current = doc;
    if (needsActor) {
      const actor = await getActor(doc.actorId);
      if (!actor) {
        console.warn(`  ${objectType} ${doc.id}: actorId ${doc.actorId} not found in users`);
        continue;
      }
      if (!DRY_RUN) {
        await Model.updateOne({ id: doc.id }, { $set: { actor } });
        current = { ...doc, actor };
      }
      actorFilled++;
    }

    if (needsFeedItem) {
      if (!DRY_RUN) {
        await writeFeedItems(current, objectType);
      }
      feedItemsWritten++;
    }
  }

  console.log(
    `${objectType}: ${docs.length} total, ${skipped} ok, ${actorFilled} actor-filled, ${feedItemsWritten} FeedItems written`,
  );
}

console.log(DRY_RUN ? "DRY RUN — no writes\n" : `Backfilling against ${domain}\n`);

await backfillModel(Post, "Post");
await backfillModel(Reply, "Reply");
await backfillModel(Page, "Page");

await mongoose.disconnect();
console.log("\nDone.");
