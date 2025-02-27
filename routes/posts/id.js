import Kowloon from "../../Kowloon.js";
import { Post } from "../../schema/index.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {};
  let query = req.user
    ? {
        id: req.params.id,
        $or: [
          { actorId: req.user.id },
          { to: { $in: [...req.user.memberships, req.user.id] } },
          { cc: { $in: [...req.user.memberships, req.user.id] } },
          { bcc: { $in: [...req.user.memberships, req.user.id] } },

          { to: "@public" },
        ],
      }
    : { id: req.params.id, to: "@public" };
  let post = await Post.findOne(query).select(
    "-flaggedAt -flaggedBy -flaggedReason -bcc -rbcc -object.bcc -object.rbcc -deletedAt -deletedBy -_id -__v -source"
  );

  if (post) {
    response.post = post;
  } else {
    response.error = "Post not found";
  }
  (response.queryTime = Date.now() - qStart), res.status(status).json(response);
}
