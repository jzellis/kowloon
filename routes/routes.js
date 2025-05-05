import Kowloon from "../Kowloon.js";
import express from "express";
import winston from "winston";

import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

// Routes
import home from "./index.js";
import activities from "./activities/index.js";
import activityById from "./activities/id.js";
import bookmarks from "./bookmarks/index.js";
import bookmarksById from "./bookmarks/id.js";
import circles from "./circles/index.js";
import circleById from "./circles/id.js";
import groups from "./groups/index.js";
import groupById from "./groups/id.js";
import groupByIdPosts from "./groups/posts.js";
import groupByIdMembers from "./groups/members.js";
import posts from "./posts/index.js";
import postById from "./posts/id.js";
import postReactsById from "./posts/reacts.js";
import postRepliesById from "./posts/replies.js";
import users from "./users/index.js";
import userById from "./users/id.js";
import userActivities from "./users/activities.js";
import userBookmarks from "./users/bookmarks.js";
import userCircles from "./users/circles.js";
import userGroups from "./users/groups.js";
import userPosts from "./users/posts.js";
import userReacts from "./users/reacts.js";
import userReplies from "./users/replies.js";
import userInbox from "./users/inbox.js";
import userOutbox from "./users/outbox.js";
import idGet from "./id/index.js";
import outboxGet from "./outbox/get.js";
import inboxGet from "./inbox/get.js";
import test from "./test.js";
// Post Routes
import login from "./login/index.js";
import auth from "./auth/get.js";
import inboxPost from "./inbox/post.js";
import fileGet from "./files/get.js";
import filePost from "./files/post.js";
import preview from "./utils/preview.js";
import setup from "./setup/index.js";
import User from "../schema/User.js";
import id from "./id/index.js";

const routes = {
  get: {
    "/auth": auth,

    "/": home,
    "/activities": activities,
    "/activities/:id": activityById,
    "/circles": circles,
    "/circles/:id": circleById,
    "/bookmarks": bookmarks,
    "/bookmarks/:id": bookmarksById,
    "/groups": groups,
    "/groups/:id": groupById,
    "/groups/:id/posts": groupByIdPosts,
    "/groups/:id/members": groupByIdMembers,

    "/posts": posts,
    "/posts/:id": postById,
    "/posts/:id/replies": postRepliesById,
    "/posts/:id/reacts": postReactsById,
    "/users": users,
    "/users/:id": userById,
    "/users/:id/activities": userActivities,
    "/users/:id/circles": userCircles,
    "/users/:id/bookmarks": userBookmarks,
    "/users/:id/groups": userGroups,
    "/users/:id/posts": userPosts,
    "/users/:id/replies": userReplies,
    "/users/:id/reacts": userReacts,
    "/users/:id/inbox": userInbox,
    "/users/:id/outbox": userOutbox,
    "/id/:id": idGet,
    "/inbox": function () {},
    "/outbox": outboxGet,
    "/inbox": inboxGet,
    "/test": test,
    "/files/:id": fileGet,
    "/utils/preview": preview,
    "/setup": setup,
  },
  post: {
    "/login": login,
    "/logout": function () {},
    "/inbox": inboxPost,
    "/outbox": function () {},
    "/files": filePost,
  },
};

const router = express.Router();

// const staticPage = await fs.readFile("./frontend/dist/index.html", "utf-8");

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

router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");

  if (
    req.headers["kowloon-id"] &&
    req.headers["kowloon-signature"] &&
    req.headers["kowloon-timestamp"]
  ) {
    let serverId = req.headers["kowloon-server-id"] || null;
    let serverTimestamp = req.headers["kowloon-server-timestamp"] || null;
    let serverSignature = req.headers["kowloon-server-signature"] || null;
    let result = await Kowloon.authenticateRequest(
      {
        id: req.headers["kowloon-id"],
        timestamp: req.headers["kowloon-timestamp"],
        signature: req.headers["kowloon-signature"],
      },
      {
        serverId,
        serverTimestamp,
        serverSignature,
      }
    );
    if (result.user) {
      req.user = result.user;
      req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
    }
    if (result.server) {
      req.server = result.server;
      req.server.memberships = await Kowloon.getUserMemberships(req.server.id);
    }
  } else {
    req.user = null;
  }
  // if (req.headers.accept != "application/json") {
  //   express.static("./frontend/dist/")(req, res, next); //this is a
  // } else {
  //   next();
  // }

  let logline = `${req.method} ${req.url}`;
  if (req.user) logline += ` | User: ${req.user.id}`;
  if (req.server) logline += ` | Server: ${req.server.id}`;

  logger.info(logline);

  for (const [url, route] of Object.entries(routes.get)) {
    router.get(`${url}`, route);
  }

  for (const [url, route] of Object.entries(routes.post)) {
    router.post(`${url}`, route);
  }

  next();
});

export default router;
