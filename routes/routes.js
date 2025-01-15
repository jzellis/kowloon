import Kowloon from "../Kowloon.js";
import express from "express";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import winston from "winston";
import klawSync from "klaw-sync";
import expressListEndpoints from "express-list-endpoints";
// Routes

const router = express.Router();

const staticPage = await fs.readFile("./frontend/dist/index.html", "utf-8");

const logger = winston.createLogger({
  // Log only if level is less than (meaning more severe) or equal to this
  level: "info",
  // Use timestamp and printf to create a standard log format
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
  ),
  // Log to the console and a file
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/server.log" }),
  ],
});

let allRoutes = { get: {}, post: {}, put: {}, delete: {} };

let controllers = klawSync(__dirname, { nodir: true });

controllers
  .filter((file) => ~file.path.indexOf(".js"))
  .map((r) => {
    let filename = console.log(r.path.replace(__dirname, ""));
    let [route, method, ext] = r.path.replace(__dirname, "").split(".");
    route = route.replace("index", "");
    switch (method) {
      case "get":
        allRoutes.get[route] = async function () {
          return (await import(r.path)).default(...arguments);
        };

        break;
      case "post":
        allRoutes.post[route] = async function () {
          return (await import(r.path)).default(...arguments);
        };
        break;
      case "put":
        allRoutes.put[route] = async function () {
          return (await import(r.path)).default(...arguments);
        };
        break;
      case "delete":
        allRoutes.delete[route] = async function () {
          return (await import(r.path)).default(...arguments);
        };
        break;
    }
  });

console.log(allRoutes);
router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.originalUrl.startsWith("/api"))
    res.header("Content-Type", "application/kowloon+json");

  if (req.headers["kowloon-id"] && req.headers.authorization) {
    let auth = await Kowloon.auth(
      req.headers["kowloon-id"],
      req.headers.authorization
    );
    if (auth.user)
      auth.user.local = (await Kowloon.isLocal(auth.user?.id)) || null;
    req.user = auth.user || null;
    if (req.user) {
      req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
      req.user.blockedUsers = (
        await Kowloon.getCircle({ id: req.user.blocked })
      ).members;
      req.user.mutedUsers = (
        await Kowloon.getCircle({ id: req.user.muted })
      ).members;
    }
  }
  logger.info(
    `${req.method} ${req.url} | ${req.ip}${req.user ? " | " + req.user.id : ""}`
  );

  //If they go to the home page, just send the React frontend
  router.get("/", async (req, res) => {
    res.status(200).send(staticPage);
  });

  for (const [url, route] of Object.entries(allRoutes.get)) {
    router.get(`/api${url}`, route);
  }

  for (const [url, route] of Object.entries(allRoutes.post)) {
    router.post(`/api${url}`, route);
  }

  for (const [url, route] of Object.entries(allRoutes.put)) {
    router.put(`/api${url}`, route);
  }
  for (const [url, route] of Object.entries(allRoutes.delete)) {
    router.delete(`/api${url}`, route);
  }
  next();
});

export default router;
