import Kowloon from "../Kowloon.js";
import express from "express";
import fs from "fs/promises";
import winston from "winston";

// Routes
import home from "./get/home.js";
import postsGet from "./get/posts.js";
import postGet from "./get/post.js";
import activitiesGet from "./get/activities.js";
import activityGet from "./get/activity.js";
import groupsGet from "./get/groups.js";
import groupGet from "./get/group.js";
import circlesGet from "./get/circles.js";
import circleGet from "./get/circle.js";
import usersGet from "./get/users.js";
import userGet from "./get/user.js";
import userPostsGet from "./get/userPosts.js";
import userCirclesGet from "./get/userCircles.js";
import userGroupsGet from "./get/userGroups.js";
import userActivitiesGet from "./get/userActivities.js";
import groupPostsGet from "./get/groupPosts.js";
import circlePostsGet from "./get/circlePosts.js";
import inboxGet from "./get/inbox.js";

import loginPost from "./post/login.js";
import verifyPost from "./post/verify.js";
import inboxPost from "./post/inbox.js";

const router = express.Router();

const staticPage = await fs.readFile("./public/index.html", "utf-8");

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
  get: {
    "": home,
    posts: postsGet,
    activities: activitiesGet,
    groups: groupsGet,
    circles: circlesGet,
    users: usersGet,
    "activities/:id": activityGet,
    "posts/:id": postGet,
    "users/:id": userGet,
    "circles/:id": circleGet,
    "circles/:id/posts": circlePostsGet,
    "groups/:id": groupGet,
    "groups/:id/posts": groupPostsGet,
    "users/:id/posts": userPostsGet,
    "users/:id/circles": userCirclesGet,
    "users/:id/groups": userGroupsGet,
    "users/:id/activities": userActivitiesGet,
    "users/:id/inbox": inboxGet,
    "users/:id/outbox": userPostsGet,
  },
  post: {
    login: loginPost,
    verify: verifyPost,
    inbox: inboxPost,
  },
};

router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Content-Type", "application/kowloon+json");
  let token = req.headers.authorization
    ? req.headers.authorization.split("Basic ")[1]
    : undefined;
  if (token && token.length > 0) {
    let user = token ? await Kowloon.auth(token) : undefined;
    if (!user && req.headers["kowloon-id"] && token) {
      user = await Kowloon.verifyRemoteUser(req.headers["kowloon-id"], token);
    }
    req.user = user || null;
  }
  logger.info(
    `${req.method} ${req.url} | ${req.ip}${req.user ? " | " + req.user.id : ""}`
  );
  for (const [url, route] of Object.entries(routes.get)) {
    router.get(`/${url}`, route);
  }
  for (const [url, route] of Object.entries(routes.post)) {
    router.post(`/${url}`, route);
  }

  next();
});

export default router;
