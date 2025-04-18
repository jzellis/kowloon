import {
  Post,
  Bookmark,
  Circle,
  Group,
  React,
  File,
  User,
  Reply,
} from "../../schema/index.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export default async function (activity) {
  const dbs = { Post, Bookmark, Circle, Group, React, File, User, Reply };

  let query = { id: activity.target };
  let actor = await User.findOne({ id: activity.actorId });
  if (!actor.isAdmin) query.actorId = activity.actorId;
  let item = await dbs[activity.objectType].findOne(query);
  item.deletedAt = new Date();
  item.deletedBy = activity.actorId;
  await item.save();

  return activity;
}
