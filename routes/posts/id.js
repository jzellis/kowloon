import { query } from "express";
import Kowloon from "../../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let post = await Kowloon.getPost({ id: req.params.id });
  let response = {
    queryTime: Date.now() - qStart,
  };

  if (post) {
    response.post = post;
  } else {
    response.error = "Post not found";
  }

  res.status(status).json(response);
}
