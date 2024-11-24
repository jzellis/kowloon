// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Activity, User } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let sort = { createdAt: -1 };
  let query = { deletedAt: null };
  response.activities = await Activity.find(query)
    .sort(sort)
    .select("-_id -__v -deletedAt -deletedBy");

  res.status(status).json(response);
}
