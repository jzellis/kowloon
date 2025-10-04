// methods/utils/init.js
import mongoose from "mongoose";
import defaultSettings from "../../config/defaultSettings.js";
import defaultUser from "../../config/defaultUser.js";
import { Settings, User } from "#schema";

/**
 * Initialize DB, settings, and a default admin user if none exists.
 * Mutates `kowloon.settings` and `kowloon.connection`.
 *
 * @param {object} kowloon - The Kowloon object to mutate.
 * @param {object} ctx     - { domain, siteTitle, adminEmail, smtpHost, smtpUser, smtpPass }
 */
export default async function init(kowloon, ctx) {
  console.log("Establishing Kowloon database connection...");
  try {
    const db = await mongoose.connect(process.env.MONGO_URI);
    kowloon.connection.isConnected = db.connections[0]?.readyState === 1;
    console.log("Kowloon database connection established");
  } catch (e) {
    console.error(e);
    process.exit(0);
  }

  // Ensure default settings exist
  const defaults = defaultSettings(ctx);
  for (const [name, value] of Object.entries(defaults)) {
    const exists = await Settings.findOne({ name }).lean();
    if (!exists) {
      await Settings.create({ name, value });
      console.log("Created setting:", name);
    }
  }

  // Load settings into memory
  const settings = await Settings.find().lean();
  for (const s of settings) {
    kowloon.settings[s.name] = s.value;
  }
  console.log("Kowloon settings loaded");

  // Ensure at least one user (create default admin if none)
  const hasUser = await User.findOne().lean();
  if (!hasUser) {
    const adminUser = defaultUser(ctx);
    const adminPassword = adminUser.password;
    const createdUser = await User.create(adminUser);

    await Settings.findOneAndUpdate(
      { name: "adminUsers" },
      { value: [createdUser.id] },
      { upsert: true }
    );

    console.log("Created default admin user with password:", adminPassword);
  }
}
