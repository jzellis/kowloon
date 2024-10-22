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
  let activities = await Activity.countDocuments({});
  let bookmarks = await Bookmark.countDocuments({});
  let circles = await Circle.countDocuments({});
  let groups = await Group.countDocuments({});
  let posts = await Post.countDocuments({});
  let users = await User.countDocuments({});
  let newestUsers = await User.find({})
    .lean()
    .select("-_id username id createdAt")
    .limit(5)
    .sort({ createdAt: -1 });

  let newestActivities = await Activity.find({ public: true })
    .lean()
    .select("-_id id summary createdAt")
    .limit(5)
    .sort({ createdAt: -1 });

  let newestGroups = await Group.find({ public: true })
    .lean()
    .select("-_id id name createdAt")
    .limit(5)
    .sort({ createdAt: -1 });

  let newestCircles = await Circle.find({ public: true })
    .lean()
    .select("-_id id name createdAt")
    .limit(5)
    .sort({ createdAt: -1 });

  let newestPosts = await Post.find({
    $or: [{ to: "_public@server.name" }, { to: "_server@server.name" }],
  })
    .lean()
    .select("-_id id actorId title source.content createdAt")
    .limit(5)
    .sort({ createdAt: -1 });

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

  let blockedDomains = (
    await Settings.findOne({ name: "blockedDomains" }).lean()
  ).value;

  response = {
    activities,
    bookmarks,
    circles,
    groups,
    posts,
    users,
    newest: {
      users: newestUsers,
      activities: newestActivities,
      groups: newestGroups,
      circles: newestCircles,
      posts: newestPosts,
    },
    flagged: {
      posts: flaggedPosts,
      users: flaggedUsers,
      groups: flaggedGroups,
    },
    blockedDomains: blockedDomains.length,
  };
  res.status(status).json(response);
}
