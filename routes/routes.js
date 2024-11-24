import Kowloon from "../Kowloon.js";
import express from "express";
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import winston from "winston";

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

const routes = {
  get: {},
  post: {},
};

// This loads routes from the directory structure in this folder. Each folder is an endpoint that can have GET and POST routes defined by the "get.js" and "post.js" files respectively. Folders that begin with a colon (:) are used as parameters, so for example the directory /posts/:id passes req.params.id to the get and post routes.
const list = [];
const rreaddir = async (dir) => {
  let files = (await fs.readdir(dir, { withFileTypes: true }))
    .filter((f) => f.isDirectory() && f.name != "admin")
    .map((f) => `${f.path}/${f.name}`);
  // return list;
  for (const f of files) {
    list.push(f);
    await rreaddir(f);
  }
  return list;
};

await rreaddir(__dirname);

list.map((f) => {
  try {
    routes.get[f.split(__dirname)[1]] = async function (x, y) {
      return (await import(`${f}/get.js`)).default(x, y);
    };
    routes.post[f.split(__dirname)[1]] = async function (x, y) {
      return (await import(`${f}/post.js`)).default(x, y);
    };
  } catch (e) {}
});

routes.get["/"] = async function (req, res) {
  return (await import(`${__dirname}/home.js`)).default(req, res);
};

let adminRoutes = {
  get: {},
  post: {},
  put: {},
  delete: {},
};
let adminFiles = (
  await fs.readdir(__dirname + "/admin", { withFileTypes: true })
).filter((f) => !f.isDirectory());

await Promise.all(
  adminFiles.map(async (f) => {
    try {
      if (f.name.indexOf("get") > -1) {
        adminRoutes.get[
          f.name.indexOf("index") < 0
            ? `${f.name.split(".get")[0].split(".")[0]}`
            : "/"
        ] = async function (x, y) {
          return (await import(`${f.path}/${f.name}`)).default(x, y);
        };
      }
      if (f.name.indexOf("post") > -1) {
        adminRoutes.post[
          f.name.indexOf("index") < 0
            ? `${f.name.split(".post")[0].split(".")[0]}`
            : "/"
        ] = async function (x, y) {
          return (await import(`${f.path}/${f.name}`)).default(x, y);
        };
      }
      if (f.name.indexOf("put") > -1) {
        adminRoutes.put[
          f.name.indexOf("index") < 0
            ? `${f.name.split(".put")[0].split(".")[0]}`
            : "/"
        ] = async function (x, y) {
          return (await import(`${f.path}/${f.name}`)).default(x, y);
        };
      }
      if (f.name.indexOf("delete") > -1) {
        adminRoutes.delete[
          f.name.indexOf("index") < 0
            ? `${f.name.split(".delete")[0].split(".")[0]}`
            : "/"
        ] = async function (x, y) {
          return (await import(`${f.path}/${f.name}`)).default(x, y);
        };
      }
    } catch (e) {}
  })
);

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
  }
  logger.info(
    `${req.method} ${req.url} | ${req.ip}${req.user ? " | " + req.user.id : ""}`
  );

  //If they go to the home page, just send the React frontend
  router.get("/", async (req, res) => {
    res.status(200).send(staticPage);
  });

  for (const [url, route] of Object.entries(routes.get)) {
    router.get(`/api${url}`, route);
  }
  for (const [url, route] of Object.entries(routes.post)) {
    router.post(`/api${url}`, route);
  }
  for (const [url, route] of Object.entries(adminRoutes.get)) {
    router.get(`/api/admin${url}`, route);
  }
  for (const [url, route] of Object.entries(adminRoutes.post)) {
    router.post(`/api/admin${url}`, route);
  }
  for (const [url, route] of Object.entries(adminRoutes.put)) {
    router.put(`/api/admin${url}`, route);
  }
  for (const [url, route] of Object.entries(adminRoutes.delete)) {
    router.delete(`/api/admin${url}`, route);
  }
  next();
});

export default router;
