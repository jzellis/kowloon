// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { User } from "../../schema/index.js";
export default async function (req, res) {
  console.log(req.query);
  let status = 200;
  let response = {};
  let query = {};
  let pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : 20;
  let sort = {};
  if (req.query.sortBy) {
    sort[req.query.sortBy] = -1;
  } else {
    sort.createdAt = -1;
  }
  if (req.query.search) query = { $text: { $search: `*${req.query.search}` } };

  let users = await User.find(query)
    .lean()
    .select("-_id id username profile")
    .limit(req.query.pageSize ? pageSize : 0)
    .skip(req.query.page ? pageSize * (parseInt(req.query.page) - 1) : 0)
    .sort(sort);
  response = {
    users,
  };
  res.status(status).json(response);
}
