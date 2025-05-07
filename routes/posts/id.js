import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = {
    ...(await Kowloon.generateQuery(req.user?.id)),
    id: req.params.id,
  };

  let post = await Post.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (post) {
    response = {
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Post",
      post,
    };
    // response.activities = await Post.find(query);
  } else {
    response.error = "Post not found";
  }
  response.query = query;
  response.queryTime = Date.now() - qStart;

  res.status(status).json(response);
}
