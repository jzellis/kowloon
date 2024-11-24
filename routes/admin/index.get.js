// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import {
  Circle,
  Group,
  Post,
  Settings,
  User,
  File,
} from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  response.settings = await Settings.find().select("-_id -__v").lean();
  response.users = await User.find().countDocuments();
  response.posts = await Post.find().countDocuments();
  response.circles = await Circle.find().countDocuments();
  response.groups = await Group.find().countDocuments();
  response.files = await File.find().countDocuments();
  res.status(status).json(response);
}
