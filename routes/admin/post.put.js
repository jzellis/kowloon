// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = {};

  response.post = await Post.create(req.body.post);

  res.status(status).json(response);
}
