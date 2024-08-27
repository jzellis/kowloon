import {
  Activity,
  Bookmark,
  Circle,
  Group,
  Like,
  Post,
  User,
} from "../schema/index.js";

import sanitize from "./sanitize.js";

let types = { Activity, Bookmark, Circle, Group, Like, Post, User };
let result;

export default async function (
  id,
  options = { deleted: false, sanitized: true }
) {
  let criteria = options.deleted ? { id: id } : { id: id, deletedAt: null };
  if (id.charAt(0) != "@") {
    let [type, wholeid] = id.split(":");
    type = type.charAt(0).toUpperCase() + type.slice(1);
    result = options.sanitized
      ? sanitize(await types[type].findOne(criteria))
      : await types[type].findOne(criteria);
  } else {
    result = options.sanitized
      ? sanitize(await User.findOne(criteria))
      : await User.findOne(criteria);
  }
  return result;
}
