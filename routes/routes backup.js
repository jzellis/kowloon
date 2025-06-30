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

import { createRemoteJWKSet, jwtVerify } from "jose";

import collection from "./collection.js";

// Routes
// import home from "./index.js";
// import activities from "./activities/index.js";
// import activityById from "./activities/id.js";
// import bookmarks from "./bookmarks/index.js";
// import bookmarksById from "./bookmarks/id.js";
// import circles from "./circles/index.js";
// import circleById from "./circles/id.js";
// import circleByIdMembers from "./circles/members.js";
// import events from "./events/index.js";
// import eventsById from "./events/id.js";
// import groups from "./groups/index.js";
// import groupById from "./groups/id.js";
// import groupByIdPosts from "./groups/posts.js";
// import groupByIdBookmarks from "./groups/bookmarks.js";
// import groupByIdMembers from "./groups/members.js";
// import pageById from "./pages/id.js";
// import pages from "./pages/index.js";
// import posts from "./posts/index.js";
// import postById from "./posts/id.js";
// import postReactsById from "./posts/reacts.js";
// import postRepliesById from "./posts/replies.js";
// import users from "./users/index.js";
// import userById from "./users/id.js";
// import userActivities from "./users/activities.js";
// import userBookmarks from "./users/bookmarks.js";
// import userCircles from "./users/circles.js";
// import userGroups from "./users/groups.js";
// import userPosts from "./users/posts.js";
// import userReacts from "./users/reacts.js";
// import userReplies from "./users/replies.js";
// import userInbox from "./users/inbox.js";
// import userOutbox from "./users/outbox.js";
// import userTimeline from "./users/timeline.js";
// import idGet from "./id/index.js";
// import outboxGet from "./outbox/get.js";
// import outboxPost from "./outbox/post.js";
// import inboxGet from "./inbox/get.js";
// import test from "./test.js";
// // Post Routes
// import login from "./login/index.js";
// import auth from "./auth/get.js";
// import inboxPost from "./inbox/post.js";
// import fileGet from "./files/get.js";
// import filePost from "./files/post.js";
// import preview from "./utils/preview.js";
// import setupGet from "./setup/get.js";
// import setupPost from "./setup/post.js";
// import publicKey from "./well-known/publicKey.js";
// import jwks from "./well-known/jwks.js";

// const CONFIG_FLAG = path.join(process.cwd(), ".configured");

// const routes = {
//   get: {
//     "/auth": auth,

//     "/": outboxGet,
//     "/activities": activities,
//     "/activities/:id": activityById,
//     "/circles": circles,
//     "/circles/:id": circleById,
//     "/circles/:id/members": circleByIdMembers,
//     "/bookmarks": bookmarks,
//     "/bookmarks/:id": bookmarksById,
//     "/events": events,
//     "/events/:id": eventsById,
//     "/groups": groups,
//     "/groups/:id": groupById,
//     "/groups/:id/posts": groupByIdPosts,
//     "/groups/:id/bookmarks": groupByIdBookmarks,
//     "/groups/:id/members": groupByIdMembers,
//     "/pages": pages,
//     "/pages/:id": pageById,
//     "/posts": posts,
//     "/posts/:id": postById,
//     "/posts/:id/replies": postRepliesById,
//     "/posts/:id/reacts": postReactsById,
//     "/users": users,
//     "/users/:id": userById,
//     "/users/:id/activities": userActivities,
//     "/users/:id/circles": userCircles,
//     "/users/:id/bookmarks": userBookmarks,
//     "/users/:id/groups": userGroups,
//     "/users/:id/posts": userPosts,
//     "/users/:id/replies": userReplies,
//     "/users/:id/reacts": userReacts,
//     "/users/:id/inbox": userInbox,
//     "/users/:id/outbox": userOutbox,
//     "/users/:id/timeline": userTimeline,
//     "/id/:id": idGet,
//     "/inbox": function () {},
//     "/outbox": outboxGet,
//     "/inbox": inboxGet,
//     "/test": test,
//     "/files/:id": fileGet,
//     "/utils/preview": preview,
//     "/setup": setupGet,
//     "/.well-known/public-key": publicKey,
//     "/.well-known/jwks.json": jwks,
//   },
//   post: {
//     "/login": login,
//     "/logout": function () {},
//     "/inbox": inboxPost,
//     "/outbox": outboxPost,
//     "/files": filePost,
//     "/setup": setupPost,
//   },
// };

const router = express.Router();

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

// This checks to see if the server has been configured
// if (!fs.existsSync(CONFIG_FLAG)) {
//   logger.info("Running setup");
//   router.use((req, res, next) => {
//     console.log(req.path);
//     if (req.path != "/setup" && req.method === "GET") {
//       return res.redirect("/setup");
//     } else {
//       return req.method === "GET" ? setupGet(req, res) : setupPost(req, res);
//     }
//   });
// } else {

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
    version: Kowloon.settings.version,
    profile: Kowloon.settings.profile,
    publicKey: `https://${Kowloon.settings.domain}/.well-known/public-key`,
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
        if (user.id.includes(Kowloon.settings.domain)) {
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

  router.get("/activities", (req, res, next) => collection("activities", req));

  // for (const [url, route] of Object.entries(routes.get)) {
  //   router.get(`${url}`, route);
  // }

  // for (const [url, route] of Object.entries(routes.post)) {
  //   router.post(`${url}`, route);
  // }
  next();
});
// }
export default router;
