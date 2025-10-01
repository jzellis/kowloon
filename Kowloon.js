import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
const __dirname = process.cwd();
import defaultSettings from "./config/defaultSettings.js";
import defaultUser from "./config/defaultUser.js";
import mongoose from "mongoose";
import winston from "winston";
import { Settings, User } from "./schema/index.js";
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Remove this in production, this is only for dev
const ctx = {
  domain: process.env.DOMAIN,
  siteTitle: process.env.SITE_TITLE || "My Kowloon Server",
  adminEmail: process.env.ADMIN_EMAIL || "admin@" + process.env.DOMAIN,
  smtpHost: process.env.SMTP_HOST || "",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
};

const Kowloon = {
  settings: {},
  connection: {},
  init: async function () {
    console.log("Establishing Kowloon database connection...");
    try {
      const db = await mongoose.connect(process.env.MONGO_URI);
      this.connection.isConnected = db.connections[0].readyState === 1;
      console.log("Kowloon database connection established");
    } catch (e) {
      console.error(e);
      process.exit(0);
    }

    const defaultsettings = defaultSettings(ctx);

    for (const [key, val] of Object.entries(defaultsettings)) {
      if (!(await Settings.findOne({ name: key }))) {
        await Settings.create({ name: key, value: val });
        console.log("Created setting: " + key);
      }
    }

    let settings = await Settings.find();

    settings.forEach(async (setting) => {
      this.settings[setting.name] = setting.value;
    });
    console.log("Kowloon settings loaded");

    if (!(await User.findOne())) {
      let adminUser = defaultUser(ctx);
      let adminPassword = adminUser.password;
      let createdUser = await User.create(adminUser);
      await Settings.findOneAndUpdate(
        { name: "adminUsers" },
        { value: [createdUser.id] }
      );

      console.log("Created default admin user with password: " + adminPassword);
    }
    // This loads all methods from the "methods" folder
    const methodsDir = `${dirname(fileURLToPath(import.meta.url))}/methods`;

    let files = fs.readdirSync(methodsDir).filter((f) => f.endsWith(".js"));
    console.log("Loading Kowloon methods...");
    //
    await Promise.all(
      files.map(async function (f) {
        let name = f.split(".")[0];
        try {
          let module = await import(`./methods/${f}`);
          Kowloon[name] = function () {
            return module.default(...arguments);
          };
        } catch (e) {
          console.log(e);
        }
      })
    );
    console.log("Kowloon methods loaded");
  },
  logger: winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.json}`
      )
    ),
    defaultMeta: { service: "kowloon" },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: "error.log", level: "error" }),
      new winston.transports.File({ filename: "combined.log" }),
    ],
  }),
  reservedUsernames: ["admin", "kowloon", "public"],
};

await Kowloon.init();

export default Kowloon;
