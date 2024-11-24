import {
  Post,
  Bookmark,
  Circle,
  Group,
  Like,
  File,
  User,
  Reply,
} from "../../schema/index.js";

export default async function (activity) {
  const dbs = { Post, Bookmark, Circle, Group, Like, File, User, Reply };

  let item = await dbs[activity.objectType].findOne({
    id: activity.target,
    actorId: activity.actorId,
  });
  item.deletedAt = new Date();
  item.deletedBy = activity.actorId;
  await item.save();

  return activity;
}
