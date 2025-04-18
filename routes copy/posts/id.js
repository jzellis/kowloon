import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    id: req.params.id,
  };
  let post = await Post.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );

  if (post) {
    response.post = post;
  } else {
    response.error = "Post not found";
  }
  (response.queryTime = Date.now() - qStart), res.status(status).json(response);
}
