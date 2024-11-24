// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let page = req.query.page || 1;
  let sort = { createdAt: -1 };
  let query = { deletedAt: null };
  response.posts = await Post.find(query)
    .sort(sort)
    .select("-_id -__v -deletedAt -deletedBy");

  res.status(status).json(response);
}
