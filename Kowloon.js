import * as dotenv from "dotenv";
import mongoose from "mongoose";
import setup from "./methods/setup.js";
import { Settings, User, Circle, Group } from "./schema/index.js";

// Methods
import findById from "./methods/findById.js";
import login from "./methods/login.js";
import query from "./methods/query.js";
import auth from "./methods/auth.js";
import getBookmarks from "./methods/getBookmarks.js";
import getPosts from "./methods/getPosts.js";
import getPost from "./methods/getPost.js";
import getActivities from "./methods/getActivities.js";
import getActivity from "./methods/getActivity.js";
import getUser from "./methods/getUser.js";
import getUsers from "./methods/getUsers.js";
import getGroup from "./methods/getGroup.js";
import getGroups from "./methods/getGroups.js";
import getCircle from "./methods/getCircle.js";
import getCircles from "./methods/getCircles.js";
import createActivity from "./methods/createActivity.js";
import canView from "./methods/canView.js";
dotenv.config();

const Kowloon = {
  settings: {},
  connection: {},

  init: async function () {
    const db = await mongoose.connect(process.env.MONGODB_URI);
    this.connection.isConnected = db.connections[0].readyState === 1;
    console.log("Kowloon database connection established");

    let settings = await Settings.find();
    if (settings.length === 0) await setup(); //
    settings = await Settings.find();
    settings.forEach(async (setting) => {
      this.settings[setting.name] = setting.value;
    });
  },
  response: function (
    options = {
      page: 1,
      totalItems: 0,
      items: [],
      summary: "Items",
      ordered: false,
    }
  ) {
    return {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: options.ordered ? "OrderedCollection" : "Collection",
      id: "//" + this.settings.domain,
      summary: `${this.settings.title} | ${options.summary}`,
      totalItems: options.totalItems,
      page: options.page,
      items: options.items,
      queryTime: 0,
    };
  },
  findById,
  login,
  auth,
  query,
  getPosts,
  getPost,
  getActivities,
  getActivity,
  getUser,
  getUsers,
  getGroup,
  getGroups,
  getCircle,
  getCircles,
  createActivity,
  canView,
  getBookmarks,
};

await Kowloon.init();

export default Kowloon;
