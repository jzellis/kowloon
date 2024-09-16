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
import auth from "./methods/auth.js";
import login from "./methods/login.js";
import get from "./methods/get.js";
import post from "./methods/post.js";
import verifyRemoteRequest from "./methods/verifyRemoteRequest.js";
import createVerifyToken from "./methods/createVerifyToken.js";

// Get methods
import getUser from "./methods/getUser.js";
import getPost from "./methods/getPost.js";
import getCircle from "./methods/getCircle.js";
import getActivity from "./methods/getActivity.js";
import getGroup from "./methods/getGroup.js";
import getLike from "./methods/getLike.js";
import getBookmark from "./methods/getBookmark.js";
import getActivities from "./methods/getActivities.js";
import getPosts from "./methods/getPosts.js";
import getGroups from "./methods/getGroups.js";
import getCircles from "./methods/getCircles.js";
import getUsers from "./methods/getUsers.js";
import getBookmarks from "./methods/getBookmarks.js";
import getLikes from "./methods/getLikes.js";
import getItemById from "./methods/getItemById.js";
// Create methods
import createActivity from "./methods/createActivity.js";
import createUser from "./methods/createUser.js";
// Update methods
import updateSetting from "./methods/updateSetting.js";
import updateUser from "./methods/updateUser.js";
// Delete methods
import deleteActivity from "./methods/deleteActivity.js";
import deleteBookmark from "./methods/deleteBookmark.js";
import deleteCircle from "./methods/deleteCircle.js";
import deleteGroup from "./methods/deleteGroup.js";
import deletePost from "./methods/deletePost.js";

//Remote methods
import addToOutbox from "./methods/addToOutbox.js";
import verifyRemoteUser from "./methods/verifyRemoteUser.js";
import updateFeeds from "./methods/updateFeeds.js";
import retrieveUser from "./methods/retrieveUser.js";
import retrieveActivity from "./methods/retrieveActivity.js";

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
  reservedUsernames: ["admin", "kowloon", "_public", "_server", "_recipients"],
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
  getItemById,
  createActivity,
  createUser,
  updateSetting,
  updateUser,
  deleteActivity,
  deleteBookmark,
  deleteCircle,
  deleteGroup,
  deletePost,
  addToOutbox,
  verifyRemoteRequest,
  createVerifyToken,
  verifyRemoteUser,
  updateFeeds,
  retrieveUser,
  retrieveActivity,
};

await Kowloon.init();

export default Kowloon;
