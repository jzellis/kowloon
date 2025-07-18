import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
const __dirname = process.cwd();
const CONFIG_FLAG = path.join(process.cwd(), ".configured");
dotenv.config({ path: `${dirname(fileURLToPath(import.meta.url))}/.env` });
import mongoose from "mongoose";
import winston from "winston";
import setup from "./methods/setup.js";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { Settings } from "./schema/index.js";
import processOutbox from "./methods/processOutbox.js";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Remove this in production
console.log("configured exists: ", fs.existsSync(CONFIG_FLAG));

const Kowloon = {
  settings: {},
  connection: {},
  init: async function () {
    // if (fs.existsSync(CONFIG_FLAG)) {
    console.log("Establishing Kowloon database connection...");
    try {
      const db = await mongoose.connect(process.env.MONGO_URI);
      this.connection.isConnected = db.connections[0].readyState === 1;
      console.log("Kowloon database connection established");
    } catch (e) {
      console.error(e);
      process.exit(0);
    }
    // if ((await Settings.countDocuments()) === 0) await setup(); //
    let settings = await Settings.find();
    settings.forEach(async (setting) => {
      this.settings[setting.name] = setting.value;
    });
    console.log("Kowloon settings loaded");

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
