// scripts/init-from-state.js
// Idempotent DB seeder for first boot.
// Reads /usr/src/app/.config/seed.json and writes /usr/src/app/.config/.configured when done.

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// TODO: adjust to YOUR actual models/paths
import { User, Settings } from "../schema/index.js";

const CONFIG_DIR = process.env.CONFIG_DIR || "/usr/src/app/.config";
const SEED_PATH = path.join(CONFIG_DIR, "seed.json");
const FLAG_PATH = path.join(CONFIG_DIR, ".configured");
const DOMAIN = process.env.DOMAIN;

async function main() {
  // Already configured?
  if (fs.existsSync(FLAG_PATH)) {
    console.log("[init] .configured exists -- skipping.");
    return;
  }
  if (!fs.existsSync(SEED_PATH)) {
    console.log("[init] No seed.json -- nothing to do.");
    return;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGO_URI is not set");

  console.log("[init] Connecting to Mongo...");
  await mongoose.connect(mongoUri);

  const raw = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const adminEmail = raw?.admin?.email;
  const adminPassword = raw?.admin?.password;
  const siteTitle = raw?.site?.title || "Kowloon";

  if (!adminEmail || !adminPassword) {
    console.log("[init] Seed missing admin credentials; aborting.");
    await mongoose.disconnect();
    return;
  }

  console.log("[init] Upserting site settings...");
  let defaultSettings = {
    actorId: `@${DOMAIN}`,
    profile: {
      name: siteTitle,
      subtitle: "My brand new Kowloon server",
      description:
        "<p>This is a new Kowloon server that I've set up. It's going to be a great place for me and my community to share ideas with each other and the world!</p>",
      location: {
        name: "Kowloon Walled City, Hong Kong",
        type: "Place",
        latitude: "22.332222",
        longitude: "114.190278",
      },
      icon: "/images/icons/server.png",
      urls: [`https://${process.env.KOWLOON_DOMAIN}`],
    },
    domain: DOMAIN,
    registrationIsOpen: false,
    maxUploadSize: 100,
    defaultPronouns: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
    blocked: {},
    likeEmojis: [
      {
        name: "Like",
        emoji: "👍",
      },
      {
        name: "Laugh",
        emoji: "😂",
      },

      {
        name: "Love",
        emoji: "❤️",
      },
      {
        name: "Sad",
        emoji: "😭",
      },
      {
        name: "Angry",
        emoji: "🤬",
      },
      {
        name: "Shocked",
        emoji: "😮",
      },
      {
        name: "Puke",
        emoji: "🤮",
      },
    ],
    adminEmail: adminEmail,
    adminUsers: [`@{adminEmail}@${DOMAIN}`],
    moderatorUsers: [`@{adminEmail}@${DOMAIN}`],
    emailServer: {
      protocol: "smtp",
      host: "localhost",
      username: "test",
      password: "test",
    },
    createdAt: new Date(Date.now()),
    updatedAt: new Date(Date.now()),
  };

  await Promise.all(
    Object.keys(defaultSettings).map(
      async (s) => await Settings.create({ name: s, value: defaultSettings[s] })
    )
  );

  console.log("[init] Ensuring admin user exists...");
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    await User.create({
      username: "admin",
      password: adminPassword,
      email: adminEmail,
      profile: {
        name: "Admin",
        subtitle: "The human, the myth, the legend",
        description: "I am the admin of this server.",
        urls: [`https://${DOMAIN}`],
        icon: "",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
      },
      to: "@public",
    });
    console.log("[init] Admin user created:", adminEmail);
  } else {
    console.log("[init] Admin already present:", adminEmail);
  }

  // Mark configured + remove secrets
  fs.writeFileSync(FLAG_PATH, "ok\n", "utf8");
  try {
    fs.rmSync(SEED_PATH, { force: true });
  } catch {}

  await mongoose.disconnect();
  console.log("[init] Done.");
}

main().catch((err) => {
  console.error("[init] Failed:", err);
  process.exit(1);
});

export default main;
