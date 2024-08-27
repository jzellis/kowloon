import {
  Activity,
  Post,
  User,
  Circle,
  Group,
  Bookmark,
  Like,
} from "../schema/index.js";
import sanitize from "./sanitize.js";

const types = { Activity, Post, User, Circle, Group, Bookmark, Like };
export default async function (
  type = "Activity",
  query = {},
  options = { sanitized: true, page: 1, pageLength: 20 }
) {
  let result = await types[type]
    .find({ ...query, deletedAt: null })
    .limit(options.pageLength)
    .skip((options.page - 1) * options.pageLength)
    .populate({
      path: "actor",
      select: "username email profile keys.public",
    });
  // if (Array.isArray(result) && result.length === 1) result = result[0];
  return options.sanitized === true ? sanitize(result) : result;
}
