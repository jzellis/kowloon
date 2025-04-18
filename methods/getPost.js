// This method retrieves a post whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Post } from "../schema/index.js";
export default async function (id) {
  let post;
  post = await Post.findOne({ id, deletedAt: null }).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (!post) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/posts/${id}`);
    post = req.post || null;
  }
  return post;
}
