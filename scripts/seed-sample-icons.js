#!/usr/bin/env node
// Backfill missing/default icons on Users, Circles, and Groups using random
// images from the repo's sample-media folder, served at /sample-icons by
// the Express static mount in server/index.js.
//
// Skips records that already have a custom icon (anything not matching the
// schema-default placeholder URL).
//
// Usage:
//   MONGO_URI=... node scripts/seed-sample-icons.js [--dry-run]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { User, Circle, Group } from "../schema/index.js";
import refreshActorCache from "../methods/users/refreshActorCache.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_DIR = path.resolve(__dirname, "..", "..", "sample-media");
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

const REWRITE_SAMPLE = process.argv.includes("--rewrite-sample");

function isDefaultIcon(icon) {
  if (!icon) return true;
  if (typeof icon !== "string") return false;
  if (/\/(images|icons)\/(user|circle|group)\.(png|svg)$/i.test(icon)) return true;
  // --rewrite-sample: also re-target any existing /sample-icons/ URL (e.g. when
  // an earlier seed wrote them with the wrong base URL).
  if (REWRITE_SAMPLE && /\/sample-icons\//.test(icon)) return true;
  return false;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Build the icon URL. Honors --base-url / ICON_BASE_URL when given. Otherwise
// falls back to a sensible dev-friendly default: http://<domain>:<PORT> when
// PORT is something other than 80/443 (i.e. we're running a dev server),
// else https://<domain>.
function buildIconBase(domain) {
  const argIdx = process.argv.indexOf("--base-url");
  if (argIdx !== -1 && process.argv[argIdx + 1]) return process.argv[argIdx + 1].replace(/\/$/, "");
  if (process.env.ICON_BASE_URL) return process.env.ICON_BASE_URL.replace(/\/$/, "");
  const port = parseInt(process.env.PORT || "", 10);
  if (port && port !== 80 && port !== 443) return `http://${domain}:${port}`;
  return `https://${domain}`;
}

function buildIconUrl(domain, file) {
  return `${buildIconBase(domain)}/sample-icons/${file}`;
}

async function backfill(Model, kind, files, getDomain) {
  const docs = await Model.find({}).select("id icon profile domain server actorId").lean();
  let touched = 0;
  let skipped = 0;
  const updates = [];

  for (const doc of docs) {
    const current = kind === "User" ? (doc.profile?.icon ?? doc.icon) : doc.icon;
    if (!isDefaultIcon(current)) { skipped++; continue; }

    const domain = await getDomain(doc);
    if (!domain) { skipped++; continue; }

    const newIcon = buildIconUrl(domain, pickRandom(files));
    touched++;
    updates.push({ id: doc.id, newIcon });

    if (DRY_RUN) continue;

    if (kind === "User") {
      await Model.updateOne({ id: doc.id }, { $set: { "profile.icon": newIcon } });
      // Propagate the new icon to all denormalized actor copies (Post.actor.icon,
      // Reply.actor.icon, React.actor.icon, FeedItems.object.actor.icon) so existing
      // posts in the timeline pick up the new avatar.
      await refreshActorCache(doc.id, { icon: newIcon });
    } else {
      await Model.updateOne({ id: doc.id }, { $set: { icon: newIcon } });
    }
  }

  return { touched, skipped, sample: updates.slice(0, 5) };
}

async function main() {
  if (!fs.existsSync(SAMPLE_DIR)) {
    console.error(`Sample folder not found: ${SAMPLE_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SAMPLE_DIR).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  if (files.length === 0) {
    console.error(`No images found in ${SAMPLE_DIR}`);
    process.exit(1);
  }
  console.log(`Sample image pool: ${files.length} files`);

  await mongoose.connect(MONGO_URI);

  // Settings collection holds the server's `domain`. Used as fallback for
  // records that don't carry their own domain field.
  const Settings = mongoose.connection.collection("settings");
  const domainSetting = await Settings.findOne({ name: "domain" });
  const serverDomain = domainSetting?.value ?? null;
  if (!serverDomain) {
    console.warn("No `domain` setting found — falling back to per-doc domain fields only.");
  }

  const userDomain = (doc) => doc.domain ?? doc.id?.split("@").pop() ?? serverDomain;
  const ownerDomain = (doc) => {
    if (doc.id?.includes("@")) return doc.id.split("@").pop();
    return serverDomain;
  };

  const userResult   = await backfill(User,   "User",   files, userDomain);
  const circleResult = await backfill(Circle, "Circle", files, ownerDomain);
  const groupResult  = await backfill(Group,  "Group",  files, ownerDomain);

  for (const [kind, r] of [["Users", userResult], ["Circles", circleResult], ["Groups", groupResult]]) {
    console.log(`\n${kind}: ${r.touched} updated, ${r.skipped} skipped${DRY_RUN ? " (dry-run)" : ""}`);
    for (const u of r.sample) console.log(`  ${u.id} → ${u.newIcon}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
