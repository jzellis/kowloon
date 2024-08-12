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
export default async function (token) {
  return await User.findOne({ accessToken: token }).select(
    "-password -keys.private"
  );
}
