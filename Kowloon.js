import { dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: `${dirname(fileURLToPath(import.meta.url))}/.env` });
import mongoose from "mongoose";
import winston from "winston";
import setup from "./methods/setup.js";
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { Settings } from "./schema/index.js";

const Kowloon = {
  settings: {},
  connection: {},

  init: async function () {
    console.log("Establishing Kowloon database connection...");
    try {
      const db = await mongoose.connect(process.env.MONGODB_URI);
      this.connection.isConnected = db.connections[0].readyState === 1;
      console.log("Kowloon database connection established");
    } catch (e) {
      console.error(e);
      process.exit(0);
    }
    if ((await Settings.countDocuments()) === 0) await setup(); //
    let settings = await Settings.find();
    settings.forEach(async (setting) => {
      this.settings[setting.name] = setting.value;
    });

    // This loads all methods from the "methods" folder
    const __dirname = `${dirname(fileURLToPath(import.meta.url))}/methods`;

    let files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".js"));
    //
    await Promise.all(
      files.map(async function (f) {
        let name = f.split(".")[0];
        let module = await import(`./methods/${f}`);
        Kowloon[name] = function () {
          return module.default(...arguments);
        };
      })
    );
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
  reservedUsernames: ["admin", "kowloon", "public", "server", "recipients"],
};

// This checks for the S3 bucket and creates it if it doesn't exist.
console.log("Checking for S3 bucket...");
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_ACCESS_SECRET_KEY,
  },
  forcePathStyle: true, // S3 compatibility
});

const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: "*", // Public access
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${process.env.S3_BUCKET}/*`], // Allow access to all objects in the bucket
    },
  ],
};

try {
  await s3.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));
} catch (error) {
  if (error.name === "NotFound")
    await s3.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET }));
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: process.env.S3_BUCKET,
      Policy: JSON.stringify(policy),
    })
  );
}

await Kowloon.init();
export default Kowloon;
