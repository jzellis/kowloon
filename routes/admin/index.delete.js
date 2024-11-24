// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Settings } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  response.settings = await Settings.find().select("-_id -__v").lean();
  res.status(status).json(response);
}
