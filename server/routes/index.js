import express from "express";
import Kowloon from "../kowloon/index.js";
import fs from "fs/promises";
var router = express.Router();

import rootGetRoute from "./get/home.js";
import inboxGetRoute from "./get/inbox.js";
import outboxGetRoute from "./get/outbox.js";
import userGetRoute from "./get/user.js";
import actorsGetRoute from "./get/actors.js";
import userInboxGetRoute from "./get/userInbox.js";
import userOutboxGetRoute from "./get/userOutbox.js";
import adminGetRoute from "./get/admin.js";
import tagGetRoute from "./get/tags.js";
import previewRoute from "./get/api/preview.js";

import activityGetRoute from "./get/activity.js";
import webfingerGetRoute from "./get/webfinger.js";

// Post routes
import rootPostRoute from "./post/home.js";
import inboxPostRoute from "./post/inbox.js";
import outboxPostRoute from "./post/outbox.js";
import userPostRoute from "./post/user.js";
import loginPostRoute from "./post/login.js";
import userInboxPostRoute from "./post/userInbox.js";
import userOutboxPostRoute from "./post/userOutbox.js";
import adminPostRoute from "./post/admin.js";
import apiUserRoute from "./post/api/user.js";
import apiSetupRoute from "./post/api/setup.js";

const routes = {
  get: {
    "/": rootGetRoute,
    "/outbox": outboxGetRoute,
    "/inbox": inboxGetRoute,
    "/tags/:tag": tagGetRoute,
    "/@:username": userGetRoute,
    "/@:username/outbox": userOutboxGetRoute,
    "/@:username/inbox": userInboxGetRoute,
    "/@:username/posts/:id": activityGetRoute,
    "/actors": actorsGetRoute,
    "/.well-known/webfinger": webfingerGetRoute,
    "/admin/": adminGetRoute,
    "/api/preview": previewRoute,
  },
  post: {
    // "/": rootPostRoute,
    // "/outbox": outboxPostRoute,
    // "/inbox": inboxPostRoute,
    "/login": loginPostRoute,
    "/@:username": userPostRoute,
    "/@:username/outbox": userOutboxPostRoute,
    "/@:username/inbox": userInboxPostRoute,
    "/admin/": adminPostRoute,
    "/api/user": apiUserRoute,
    "/api/set": apiSetupRoute,
  },
};

/* GET home page. */
router.use(async (req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Authorization, Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  let token = req.headers.authorization
    ? req.headers.authorization.split("Bearer ")[1]
    : undefined;
  let user = token ? await Kowloon.auth(token) : undefined;
  req.user = user || undefined;

  next();
});

for (const [url, route] of Object.entries(routes.get)) {
  router.get(url, route);
}
for (const [url, route] of Object.entries(routes.post)) {
  router.post(url, route);
}

export default router;
