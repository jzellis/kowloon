import Kowloon from "../Kowloon.js";
import express from "express";
import winston from "winston";
import yaml from "js-yaml";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __dirname = dirname(fileURLToPath(import.meta.url));
import swaggerUi, { setup } from "swagger-ui-express";
import jwt from "jsonwebtoken";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createRemoteJWKSet, jwtVerify } from "jose";

import getCollection from "./getCollection.js";
import getItem from "./getItem.js";
import getMembers from "./getMembers.js";
import getServerOutbox from "./getServerOutbox.js";
// Route Methods

// // Post Routes
import login from "./login/index.js";
import activityPost from "./inbox/post.js";
import fileGet from "./files/get.js";
import filePost from "./files/post.js";
import preview from "./utils/preview.js";
import setupGet from "./setup/get.js";
import setupPost from "./setup/post.js";
import publicKey from "./well-known/publicKey.js";
import jwks from "./well-known/jwks.js";
import getCircleFeed from "./getCircleFeed.js";
import getUserTimeline from "./getUserTimeline.js";
import getUserPublicKey from "./getUserPublicKey.js";
import getPages from "./getPages.js";
import upload from "./well-known/upload.js";

const routes = [
  // Basic collections
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
  {
    method: "get",
    path: "/users/:id/public-key",
    handler: getUserPublicKey,
  },
  {
    method: "get",
    path: "/users/:id/inbox",
    handler: getUserTimeline,
  },
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
  {
    method: "get",
    path: "/.well-known/public-key",
    handler: publicKey,
  },
  {
    method: "get",
    path: "/.well-known/jwks.json",
    handler: jwks,
  },
  {
    method: "post",
    path: "/upload",
    handler: upload,
  },
  {
    method: "get",
    path: "/utils/preview",
    handler: preview,
    auth: true,
  },
  // POST Routes
  {
    method: "post",
    path: "/login",
    handler: login,
  },
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
];

const router = express.Router();

const isDev = process.env.NODE_ENV !== "production";

if (!isDev) {
  app.use(express.static("frontend/"));
}

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
    // new winston.transports.File({ filename: "logs/server.log" }),
  ],
});

// This serves our Swagger UI
router.get("/openapi.yaml", (req, res) => {
  const yamlPath = path.join(process.cwd(), "openapi.yaml");
  const yamlContent = fs.readFileSync(yamlPath, "utf8");
  res.type("text/yaml").send(yamlContent);
});

const openapiDocument = yaml.load(
  fs.readFileSync(path.join(process.cwd(), "openapi.yaml"), "utf8")
);

router.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");

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

  if (req.header("Authorization")) {
    const authHeader = req.header("Authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (token) {
      try {
        const decoded = jwt.decode(token, {
          complete: true,
        });
        const kid = decoded.header.kid;
        const user = decoded.payload.user;
        const loggedIn = decoded.payload.loggedIn;
        const iat = decoded.payload.iat;
        const issuer =
          decoded.payload.iss || `https://${Kowloon.settings.domain}`;
        let verified = {};
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

        if (verified.user.id == decoded.payload.user.id) {
          req.user = verified.user;

          // This returns whatever local groups and circles the user is a member of, regardless of whether they are local or remote
          req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
        }
      } catch (err) {
        console.log(err);
        return res.status(401).json({ error: "Unauthorized" });
      }
    }
  }

  let logline = `${req.method} ${req.url}`;
  if (req.user) logline += ` | User: ${req.user.id}`;
  if (req.server) logline += ` | Server: ${req.server.id}`;

  logger.info(logline);

  const requireAuth = (req, res, next) => {
    // your auth logic here
    if (req.user) return next();
    return res.status(401).json({
      error:
        "Unauthorized. You must be a logged-in member of this server to view this.",
    });
  };

  routes.forEach(
    ({ method, path, collection, type, parent, handler, auth }) => {
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

      // This handles content negotiation at request time
      middleware.push((req, res, next) => {
        if (req.headers.accept?.includes("application/json")) {
          return handler(req, res, next);
        } else {
          // Let React Router take over via Vite proxy or index.html
          next("route"); // skip remaining middleware and let fallback take over
        }
      });

      // Register the route for GET/POST/etc
      router[method](path, ...middleware);
    }
  );

  next();
});
// }
export default router;
