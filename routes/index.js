import Kowloon from "../Kowloon.js";
import express from "express";
import fs from "fs/promises";
import mime from "mime";

// Routes
import indexGet from "./get/index.js";
import activitiesGet from "./get/activities.js";
import activityGet from "./get/activity.js";
import postsGet from "./get/posts.js";
import postGet from "./get/post.js";
import usersGet from "./get/users.js";
import userGet from "./get/user.js";
import userPostsGet from "./get/userPosts.js";
import userCirclesGet from "./get/userCircles.js";
import userGroupsGet from "./get/userGroups.js";
import userBookmarksGet from "./get/userBookmarks.js";
import groupGet from "./get/group.js";
import groupsGet from "./get/groups.js";
import circleGet from "./get/circle.js";
import circlesGet from "./get/circles.js";
import activityPost from "./post/activity.js";
import loginPost from "./post/login.js";

const router = express.Router();

const staticPage = await fs.readFile("./public/index.html", "utf-8");

const routes = {
  get: {
    "/": indexGet,
    "/activities": activitiesGet,
    "/activities/:id": activityGet,

    "/posts": postsGet,
    "/posts/:id": postGet,

    "/users": usersGet,
    "/users/:id": userGet,
    "/users/:id/posts": userPostsGet,
    "/users/:id/circles": userCirclesGet,
    "/users/:id/groups": userGroupsGet,
    "/users/:id/bookmarks": userBookmarksGet,
    "/groups/": groupsGet,
    "/groups/:id": groupGet,
    "/circles/": circlesGet,
    "/circles/:id": circleGet,
  },
  post: {
    "/login": loginPost,
    "/inbox": activityPost,
  },
};

router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  let token = req.headers.authorization
    ? req.headers.authorization.split("Bearer ")[1]
    : undefined;
  if (token && token.length > 0) {
    let user = token ? await Kowloon.auth(token) : undefined;
    req.user = user || null;
  }
  for (const [url, route] of Object.entries(routes.get)) {
    router.get(url, route);
  }
  for (const [url, route] of Object.entries(routes.post)) {
    router.post(url, route);
  }

  next();
});

export default router;
