import Kowloon from "../Kowloon.js";
import express from "express";
import fs from "fs/promises";
import winston from "winston";

import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import klawSync from "klaw-sync";
import expressListEndpoints from "express-list-endpoints";
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
import posts from "./posts/index.js";
import postById from "./posts/id.js";
import users from "./users/index.js";
import userById from "./users/id.js";
import userActivities from "./users/activities.js";
import userBookmarks from "./users/bookmarks.js";
import userCircles from "./users/circles.js";
import userGroups from "./users/groups.js";
import userPosts from "./users/posts.js";
import userReacts from "./users/reacts.js";
import userReplies from "./users/replies.js";
// Post Routes
import login from "./login/index.js";

const routes = {
  get: {
    "/": home,
    "/activities": activities,
    "/activities/:id": activityById,
    "/circles": circles,
    "/circles/:id": circleById,
    "/bookmarks": bookmarks,
    "/bookmarks/:id": bookmarksById,
    "/groups": groups,
    "/posts": posts,
    "/posts/:id": postById,
    "/posts/:id/replies": function () {},
    "/posts/:id/reacts": function () {},
    "/users": users,
    "/users/:id": userById,
    "/users/:id/activities": userActivities,
    "/users/:id/circles": userCircles,
    "/users/:id/bookmarks": userBookmarks,
    "/users/:id/groups": userGroups,
    "/users/:id/posts": userPosts,
    "/users/:id/replies": userReplies,
    "/users/:id/reacts": userReacts,
    "/inbox": function () {},
    "/outbox": function () {},
  },
  post: {
    "/login": login,
    "/logout": function () {},
    "/auth": function () {},
    "/outbox": function () {},
  },
};

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

router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");

  logger.info(
    `${req.method} ${req.url} | ${req.ip}${req.user ? " | " + req.user.id : ""}`
  );

  if (req.headers["kowloon-id"] && req.headers.authorization) {
    let auth = await Kowloon.auth(
      req.headers["kowloon-id"],
      req.headers.authorization
    );

    if (auth.user) {
      req.user = auth.user;
      req.user.local = req.user.id.split("@").pop() === Kowloon.settings.domain;
      req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
    }
  }
  // if (req.headers.accept != "application/json") {
  //   express.static("./frontend/dist/")(req, res, next); //this is a
  // } else {
  //   next();
  // }

  for (const [url, route] of Object.entries(routes.get)) {
    router.get(`${url}`, route);
  }

  for (const [url, route] of Object.entries(routes.post)) {
    router.post(`${url}`, route);
  }

  next();

  //   if (auth.user)
  //     auth.user.local = (await Kowloon.isLocal(auth.user?.id)) || null;
  //   req.user = auth.user || null;
  //   if (req.user) {
  //     req.user.memberships = await Kowloon.getUserMemberships(req.user.id);
  //     req.user.blockedUsers = (
  //       await Kowloon.getCircle({ id: req.user.blocked })
  //     ).members;
  //     req.user.mutedUsers = (
  //       await Kowloon.getCircle({ id: req.user.muted })
  //     ).members;
  //   }
  // }

  // //If they go to the home page, just send the React frontend
  // router.get("/", async (req, res) => {
  //   res.status(200).send(staticPage);
  // });

  // for (const [url, route] of Object.entries(allRoutes.get)) {
  //   router.get(`/api${url}`, route);
  // }

  // for (const [url, route] of Object.entries(allRoutes.post)) {
  //   router.post(`/api${url}`, route);
  // }

  // for (const [url, route] of Object.entries(allRoutes.put)) {
  //   router.put(`/api${url}`, route);
  // }
  // for (const [url, route] of Object.entries(allRoutes.delete)) {
  //   router.delete(`/api${url}`, route);
  // }
  // res.send("OK");
});

export default router;
