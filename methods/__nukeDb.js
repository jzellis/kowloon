import {
  Activity,
  Bookmark,
  Circle,
  Group,
  React,
  Post,
  Feed,
  FeedItem,
  User,
} from "../schema/index.js";

export default async function () {
  await Activity.deleteMany({});
  await Bookmark.deleteMany({});
  await Circle.deleteMany({});
  await Group.deleteMany({});
  await React.deleteMany({});
  await Post.deleteMany({});
  await User.deleteMany({});
  await Feed.deleteMany({});
  await FeedItem.deleteMany({});
  return true;
}
