// Returns all public posts from the server

import Kowloon from "../../Kowloon.js";
import {
  Activity,
  Bookmark,
  Circle,
  Group,
  Post,
  User,
  Settings,
} from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let response = {};

  let flaggedPosts = await Post.find({
    flagged: true,
    deletedAt: { $eq: null },
  })
    .lean()
    .select("-_id id actorId title source.content")
    .sort({ createdAt: -1 });

  let flaggedUsers = await User.find({
    flagged: true,
    deletedAt: { $eq: null },
  })
    .lean()
    .select("-_id id username")
    .sort({ createdAt: -1 });

  let flaggedGroups = await Group.find({
    flagged: true,
    deletedAt: { $eq: null },
  })
    .lean()
    .select("-_id id username")
    .sort({ createdAt: -1 });

  response = {
    posts: flaggedPosts,
    users: flaggedUsers,
    groups: flaggedGroups,
  };
  res.status(status).json(response);
}
