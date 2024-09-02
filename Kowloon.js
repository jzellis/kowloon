import { dirname } from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
dotenv.config({ path: `${dirname(fileURLToPath(import.meta.url))}/.env` });
import mongoose from "mongoose";
import winston from "winston";

import { Settings, User, Circle, Group } from "./schema/index.js";

// Methods
// Core methods
import setup from "./methods/setup.js";
import auth from "./methods/auth/auth.js";
import login from "./methods/auth/login.js";
import get from "./methods/remote/get.js";
import post from "./methods/remote/post.js";
import verifyRemoteRequest from "./methods/auth/verifyRemoteRequest.js";
import createVerifyToken from "./methods/auth/createVerifyToken.js";

// Get methods
import getUser from "./methods/get/getUser.js";
import getPost from "./methods/get/getPost.js";
import getCircle from "./methods/get/getCircle.js";
import getActivity from "./methods/get/getActivity.js";
import getGroup from "./methods/get/getGroup.js";
import getLike from "./methods/get/getLike.js";
import getBookmark from "./methods/get/getBookmark.js";
import getActivities from "./methods/get/getActivities.js";
import getPosts from "./methods/get/getPosts.js";
import getGroups from "./methods/get/getGroups.js";
import getCircles from "./methods/get/getCircles.js";
import getUsers from "./methods/get/getUsers.js";
import getBookmarks from "./methods/get/getBookmarks.js";
import getLikes from "./methods/get/getLikes.js";
import findById from "./methods/get/findById.js";
// Create methods
import createActivity from "./methods/create/createActivity.js";
import createUser from "./methods/create/createUser.js";
// Update methods
import updateSetting from "./methods/update/updateSetting.js";
import updateUser from "./methods/update/updateUser.js";
// Delete methods
import deleteActivity from "./methods/delete/deleteActivity.js";
import deleteBookmark from "./methods/delete/deleteBookmark.js";
import deleteCircle from "./methods/delete/deleteCircle.js";
import deleteGroup from "./methods/delete/deleteGroup.js";
import deletePost from "./methods/delete/deletePost.js";

//Remote methods
import addToInbox from "./methods/delivery/addToInbox.js";
import addToOutbox from "./methods/delivery/addToOutbox.js";
import verifyRemoteUser from "./methods/auth/verifyRemoteUser.js";
import getInbox from "./methods/get/getInbox.js";
import updateFeeds from "./methods/follow/updateFeeds.js";
import retrieveUser from "./methods/get/retrieveUser.js";
import retrieveActivity from "./methods/get/retrieveActivity.js";

const Kowloon = {
  settings: {},
  connection: {},

  init: async function () {
    console.log("Establishing Kowloon database connection...");
    try {
      const db = await mongoose.connect(process.env.MONGODB_URI);
      this.connection.isConnected = db.connections[0].readyState === 1;
      console.log("Kowloon database connection established");
    } catch (e) {
      console.error(e);
      process.exit(0);
    }
    let settings = await Settings.find();
    if (settings.length === 0) await setup(); //
    settings = await Settings.find();
    settings.forEach(async (setting) => {
      this.settings[setting.name] = setting.value;
    });
  },
  logger: winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.json}`
      )
    ),
    defaultMeta: { service: "kowloon" },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: "error.log", level: "error" }),
      new winston.transports.File({ filename: "combined.log" }),
    ],
  }),
  login,
  auth,
  get,
  post,
  getUser,
  getPost,
  getCircle,
  getActivity,
  getGroup,
  getLike,
  getBookmark,
  getActivities,
  getPosts,
  getGroups,
  getCircles,
  getUsers,
  getBookmarks,
  getLikes,
  findById,
  createActivity,
  createUser,
  updateSetting,
  updateUser,
  deleteActivity,
  deleteBookmark,
  deleteCircle,
  deleteGroup,
  deletePost,
  addToInbox,
  addToOutbox,
  verifyRemoteRequest,
  createVerifyToken,
  verifyRemoteUser,
  getInbox,
  updateFeeds,
  retrieveUser,
  retrieveActivity,
};

await Kowloon.init();

export default Kowloon;
