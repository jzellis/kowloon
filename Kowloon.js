import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

import * as dotenv from "dotenv";
dotenv.config();

import winston from "winston";
import { Settings, User } from "#schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function attachMethodDomains(Kowloon) {
  const methodsDir = path.join(__dirname, "methods");
  const entries = fs.readdirSync(methodsDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (ent) => {
      if (!ent.isDirectory()) return;
      const name = ent.name; // e.g., "users", "posts"
      const indexPath = path.join(methodsDir, name, "index.js");
      if (!fs.existsSync(indexPath)) return;

      try {
        const mod = await import(`./methods/${name}/index.js`);
        if (mod?.default) {
          Kowloon[name] = mod.default; // expect default export object { get, create, ... }
        } else {
          // if you prefer named exports instead of default:
          // Kowloon[name] = mod;
        }
      } catch (e) {
        console.error(`Failed to load methods/${name}:`, e);
      }
    })
  );
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // dev only

const ctx = {
  domain: process.env.DOMAIN,
  siteTitle: process.env.SITE_TITLE || "My Kowloon Server",
  adminEmail: process.env.ADMIN_EMAIL || "admin@" + process.env.DOMAIN,
  smtpHost: process.env.SMTP_HOST || "",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
};

const Kowloon = {
  // activities,
  // auth,
  // bookmarks,
  // circles,
  // events,
  // files,
  // federation,
  // generate,
  // groups,
  // inbox,
  // invites,
  // outbox,
  // pages,
  // parse,
  // posts,
  // query,
  // reacts,
  // replies,
  // users,
  // utils,
  settings: {},
  connection: {},
  // logger: winston.createLogger({
  //   level: "info",
  //   format: winston.format.combine(
  //     winston.format.timestamp(),
  //     winston.format.printf(
  //       (info) => `${info.timestamp} ${info.level}: ${info.json}`
  //     )
  //   ),
  //   defaultMeta: { service: "kowloon" },
  //   transports: [
  //     new winston.transports.Console(),
  //     new winston.transports.File({ filename: "error.log", level: "error" }),
  //     new winston.transports.File({ filename: "combined.log" }),
  //   ],
  // }),
  reservedUsernames: ["admin", "kowloon", "public"],
};

// call the standalone initializer
await attachMethodDomains(Kowloon);
await Kowloon.utils.init(Kowloon, ctx);

export default Kowloon;
