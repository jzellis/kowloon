// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let sort = req.query.sort === "alpha" ? { username: -1 } : { createdAt: -1 };
  let query = { deletedAt: null };
  response.users = await User.find(query)
    .sort(sort)
    .select("-_id -password -keys.private -__v -deletedAt");

  res.status(status).json(response);
}
