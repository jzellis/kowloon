// /methods/utils/init.js
import mongoose from "mongoose";

import defaultSettings from "#config/defaultSettings.js";
import defaultUser from "#config/defaultUser.js";
import { Settings, User, Circle } from "#schema";
import toMember from "#methods/parse/toMember.js";

function pickDbUri() {
  return (
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    null
  );
}

// IMPORTANT: this file no longer creates an Express app or mounts routes.
// It ONLY connects to Mongo and seeds settings/admin.
export default async function init(Kowloon, ctx = {}) {
  // 1) Database (idempotent)
  try {
    if (mongoose.connection.readyState !== 1) {
      const uri = pickDbUri();
      if (!uri)
        throw new Error(
          "Missing DB URI (MONGODB_URI/MONGO_URL/DATABASE_URL/MONGO_URI)."
        );
      console.log("Kowloon: connecting to Mongo…");
      await mongoose.connect(uri, { maxPoolSize: 10 });
      console.log("Kowloon: Mongo connected.");
    } else {
      console.log("Kowloon: Mongo already connected.");
    }
    Kowloon.mongoose = mongoose;
    Kowloon.connection = mongoose.connection;
  } catch (e) {
    console.error("Kowloon DB connect failed:", e);
    process.exit(1);
  }

  // 2) Seed defaults, then load settings into memory
  if (!Kowloon.settings) Kowloon.settings = {};
  const defaults = defaultSettings(ctx);
  for (const [name, value] of Object.entries(defaults)) {
    const exists = await Settings.findOne({ name }).lean();
    if (!exists) {
      await Settings.create({ name, value });
      console.log("Created setting:", name);
    }
  }

  if ((await Circle.find({}).countDocuments()) === 0) {
    const adminCircle = await Circle.create({
      name: `${ctx.SITE_TITLE || "Kowloon"} Admins`,
      to: "",
      canReact: "",
      canReply: "",
      actorId: `@${process.env.DOMAIN}`,
    });

    const modCircle = await Circle.create({
      name: `${ctx.SITE_TITLE || "Kowloon"} Moderators`,
      to: "",
      canReact: "",
      canReply: "",
      actorId: `@${process.env.DOMAIN}`,
    });

    await Settings.updateOne(
      { name: "adminCircle" },
      { value: adminCircle.id }
    );
    await Settings.updateOne({ name: "modCircle" }, { value: modCircle.id });
  }

  const settingsDocs = await Settings.find().lean();
  for (const s of settingsDocs) {
    Kowloon.settings[s.name] = s.value;
  }
  console.log("Kowloon settings loaded");

  // 3) Ensure default admin user exists
  let firstUser = await User.findOne().lean();
  if (!firstUser) {
    const adminUser = defaultUser(ctx);
    const adminPassword = adminUser.password; // only log in non-prod
    const created = await User.create(adminUser);

    const member = toMember(created);
    await Circle.findOneAndUpdate(
      { id: Kowloon.settings.adminCircle },
      { memberCount: 1, $addToSet: { members: toMember(created) } }
    );
    await Circle.findOneAndUpdate(
      { id: Kowloon.settings.modCircle },
      { memberCount: 1, $addToSet: { members: toMember(created) } }
    );

    if (process.env.NODE_ENV !== "production") {
      console.log("Created default admin user with password:", adminPassword);
    } else {
      console.log("Created default admin user");
    }
  }

  return { connection: Kowloon.connection, settings: Kowloon.settings };
}
