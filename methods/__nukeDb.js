import {
  Activity,
  Bookmark,
  Circle,
  Group,
  React,
  Reply,
  Post,
  User,
  Feed,
  Settings,
} from "../schema/index.js";
import setup from "./setup.js";

export default async function () {
  await Settings.deleteMany({});
  // await setup();
  await Activity.deleteMany({});
  await Bookmark.deleteMany({});
  await Circle.deleteMany({});
  await Feed.deleteMany({});
  await Group.deleteMany({});
  await React.deleteMany({});
  await Reply.deleteMany({});
  await Post.deleteMany({});
  await User.deleteMany({});
  return true;
}
