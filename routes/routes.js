// routes.js (refactored)
import Kowloon from "../Kowloon.js";
import express from "express";
import winston from "winston";
import yaml from "js-yaml";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
import swaggerUi from "swagger-ui-express";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Route Methods
import getCollection from "./getCollection.js";
import getItem from "./getItem.js";
import getMembers from "./getMembers.js";
import getServerOutbox from "./getServerOutbox.js";
import login from "./login/index.js";
import activityPost from "./inbox/post.js";
import fileGet from "./files/get.js";
import filePost from "./files/post.js";
import preview from "./utils/preview.js";
import setupPost from "./setup/index.js";
import publicKey from "./well-known/publicKey.js";
import jwks from "./well-known/jwks.js";
import getCircleFeed from "./getCircleFeed.js";
import getUserTimeline from "./getUserTimeline.js";
import getUserPublicKey from "./getUserPublicKey.js";
import getPages from "./getPages.js";
import upload from "./well-known/upload.js";
import createUser from "./createUser.js";

// ---------------------- ROUTE TABLE ----------------------
const routes = [
  {
    method: "get",
    path: "/activities",
    collection: "activities",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/activities/:id",
    collection: "activities",
    type: "Activity",
    handler: getItem,
  },
  {
    method: "get",
    path: "/bookmarks",
    collection: "bookmarks",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/bookmarks/:id",
    collection: "bookmarks",
    type: "Bookmark",
    handler: getItem,
  },
  {
    method: "get",
    path: "/circles",
    collection: "circles",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/circles/:id",
    collection: "circles",
    type: "Circle",
    handler: getItem,
  },
  {
    method: "get",
    path: "/circles/:id/posts",
    collection: "circles",
    type: "OrderedCollection",
    handler: getCircleFeed,
  },
  {
    method: "get",
    path: "/circles/:id/members",
    collection: "circles",
    type: "OrderedCollection",
    handler: getMembers,
  },
  {
    method: "get",
    path: "/events",
    collection: "events",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/events/:id",
    collection: "events",
    type: "Event",
    handler: getItem,
  },
  {
    method: "get",
    path: "/events/:id/members",
    collection: "events",
    type: "OrderedCollection",
    handler: getMembers,
  },
  {
    method: "get",
    path: "/groups",
    collection: "groups",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/groups/:id",
    collection: "groups",
    type: "Group",
    handler: getItem,
  },
  {
    method: "get",
    path: "/groups/:id/bookmarks",
    parent: "groups",
    collection: "bookmarks",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/groups/:id/posts",
    parent: "groups",
    collection: "posts",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/groups/:id/members",
    collection: "groups",
    type: "OrderedCollection",
    handler: getMembers,
  },
  {
    method: "get",
    path: "/pages",
    collection: "pages",
    type: "OrderedCollection",
    handler: getPages,
  },
  {
    method: "get",
    path: "/pages/:id",
    collection: "pages",
    type: "Page",
    handler: getItem,
  },
  {
    method: "get",
    path: "/posts",
    collection: "posts",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/posts/:id",
    collection: "posts",
    type: "Post",
    handler: getItem,
  },
  {
    method: "get",
    path: "/posts/:id/replies",
    parent: "posts",
    collection: "replies",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/posts/:id/reacts",
    parent: "posts",
    collection: "reacts",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users",
    collection: "users",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id",
    collection: "users",
    type: "User",
    handler: getItem,
  },
  { method: "get", path: "/users/:id/public-key", handler: getUserPublicKey },
  { method: "get", path: "/users/:id/inbox", handler: getUserTimeline },
  {
    method: "get",
    path: "/users/:id/activities",
    parent: "users",
    collection: "activities",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id/bookmarks",
    parent: "users",
    collection: "bookmarks",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id/circles",
    parent: "users",
    collection: "circles",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id/groups",
    parent: "users",
    collection: "groups",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id/posts",
    parent: "users",
    collection: "posts",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/users/:id/outbox",
    parent: "users",
    collection: "posts",
    type: "OrderedCollection",
    handler: getCollection,
  },
  {
    method: "get",
    path: "/",
    handler: getServerOutbox,
    type: "OrderedCollection",
  },
  {
    method: "get",
    path: "/outbox",
    handler: getServerOutbox,
    type: "OrderedCollection",
  },
  { method: "get", path: "/.well-known/public-key", handler: publicKey },
  { method: "get", path: "/.well-known/jwks.json", handler: jwks },
  { method: "get", path: "/utils/preview", handler: preview, auth: true },

  { method: "post", path: "/upload", handler: upload },
  { method: "post", path: "/login", handler: login },
  {
    method: "post",
    path: "/inbox",
    handler: activityPost,
    type: "OrderedCollection",
  },
  {
    method: "post",
    path: "/.well-known/inbox",
    handler: activityPost,
    type: "OrderedCollection",
  },
  { method: "post", path: "/users", handler: createUser, type: "User" },

  {
    method: "get",
    path: "/.well-known/acme-challenge/*",
    handler: (req, res) => {
      res
        .status(200)
        .send(
          "v7TkDYjeR3sn6Xza1IvWWJUBjIiq9PNWFLq-RoZLHRw.e9Me90iABMzNUNmt8PPrbpdW_ArmWICldlqcZtTwmEA"
        );
    },
  },
];

// ---------------------- ROUTER ----------------------
const router = express.Router();
const isDev = process.env.NODE_ENV !== "production";

if (!isDev) {
  router.use(express.static("frontend/"));
}

// Logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf((info) => `${info.level}: ${info.message}`)
  ),
  transports: [new winston.transports.Console()],
});

// Swagger/OpenAPI
router.get("/openapi.yaml", (req, res) => {
  const yamlPath = path.join(process.cwd(), "openapi.yaml");
  res.type("text/yaml").send(fs.readFileSync(yamlPath, "utf8"));
});
const openapiDocument = yaml.load(
  fs.readFileSync(path.join(process.cwd(), "openapi.yaml"), "utf8")
);
router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

// ---------------------- MIDDLEWARE ----------------------
router.use(async (req, res, next) => {
  // CORS
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Origin", req.get("Origin") || "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.sendStatus(204);

  // req.server
  req.server = {
    id: Kowloon.settings.actorId,
    domain: req.hostname,
    version: Kowloon.settings.version,
    profile: Kowloon.settings.profile,
    publicKey: `https://${Kowloon.settings.domain}/.well-known/public-key`,
    jwks: `https://${Kowloon.settings.domain}/.well-known/jwks.json`,
    inbox: `https://${Kowloon.settings.domain}/inbox`,
    outbox: `https://${Kowloon.settings.domain}/outbox`,
  };

  // Authorization
  if (req.header("Authorization")?.startsWith("Bearer ")) {
    const token = req.header("Authorization").slice(7).trim();
    try {
      const decoded = jwt.decode(token, { complete: true });
      const user = decoded.payload.user;
      const issuer =
        decoded.payload.iss || `https://${Kowloon.settings.domain}`;
      let verified;

      if (user.id.endsWith(Kowloon.settings.actorId)) {
        verified = jwt.verify(token, Kowloon.settings.publicKey, {
          algorithms: ["RS256"],
          issuer: `https://${Kowloon.settings.domain}`,
        });
      } else {
        const JWKS = createRemoteJWKSet(
          new URL(`${issuer}/.well-known/jwks.json`)
        );
        const remote = await jwtVerify(token, JWKS, {
          algorithms: ["RS256"],
          issuer,
        });
        verified = remote.payload;
      }

      if (verified.user.id === user.id) {
        req.user = verified.user;
        req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
      }
    } catch (err) {
      console.error(err);
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // Logging
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  let logline = `${req.method} - ${ip} - ${req.url}`;
  if (req.user) logline += ` | User: ${req.user.id}`;
  if (req.server) logline += ` | Server: ${req.server.id}`;
  logger.info(logline);

  next();
});

// ---------------------- ROUTE REGISTRATION ----------------------
function requireAuth(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

routes.forEach(({ method, path, collection, type, parent, handler, auth }) => {
  const middleware = [];
  if (auth) middleware.push(requireAuth);

  if (collection) {
    middleware.push((req, res, next) => {
      req.collection = collection;
      req.type = type || null;
      next();
    });
  }
  if (parent) {
    middleware.push((req, res, next) => {
      req.parent = parent;
      req.parentId = req.params.id;
      req.type = type || null;
      next();
    });
  }

  middleware.push((req, res, next) => handler(req, res, next));
  router[method](path, ...middleware);
});

// Setup wizard
router.get("/setup", (req, res) => {
  res.sendFile(path.join(__dirname, "./setup/page.html"));
});
router.post("/setup", express.urlencoded({ extended: true }), (req, res) => {
  setupPost(req, res);
});

export default router;
