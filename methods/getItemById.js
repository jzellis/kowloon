import Kowloon from "../Kowloon.js";
import {
  Activity,
  Bookmark,
  Circle,
  Group,
  Like,
  Post,
  User,
  Feed,
} from "../schema/index.js";

export default async function (
  id,
  options = {
    actor: false,
    deleted: false,
  }
) {
  let dbs = {
    activity: Activity,
    bookmark: Bookmark,
    circle: Circle,
    group: Group,
    like: Like,
    post: Post,
    user: User,
    feed: Feed,
  };
  let query = { id };
  if (options.deleted === false) query.deletedAt = { $eq: null };
  let populate = options.actor ? "actor -_id" : "_id";
  let returned;

  if (id.split(":").length > 1)
    returned = await dbs[id.split(":")[0]].findOne(query).populate(populate);
  // if (!returned) returned = await Activity.findOne(query).populate(populate);
  // if (!returned) returned = await Bookmark.findOne(query).populate(populate);
  // if (!returned) returned = await Circle.findOne(query).populate(populate);
  // if (!returned) returned = await Group.findOne(query).populate(populate);
  // if (!returned) returned = await Like.findOne(query).populate(populate);
  // if (!returned) returned = await Post.findOne(query).populate(populate);
  if (!returned) returned = await User.findOne(query).populate(populate);
  if (!returned) return new Error(`Object "${id}" not found`);
  return returned;
}
