import parseId from "./parseId.js";
import getSettings from "./getSettings.js";
import generateQuery from "./generateQuery.js";
import {
  Activity,
  Post,
  Bookmark,
  Circle,
  Group,
  React,
  File,
  User,
} from "../schema/index.js";

export default async function (id, userId = null) {
  const dbs = {
    Activity: {
      db: Activity,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/activities",
    },
    Post: {
      db: Post,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy -source",
      remoteUrl: "/post",
    },
    Bookmark: {
      db: Bookmark,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/bookmarks",
    },
    Circle: {
      db: Circle,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/circles",
    },
    Group: {
      db: Group,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/groups",
    },
    React: {
      db: React,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/reacts",
    },
    File: {
      db: File,
      select:
        "-_id -__v -flaggedAt -flaggedBy -flaggedReason -deletedAt -deletedBy",
      remoteUrl: "/files",
    },
    User: { db: User, select: "-_id profile prefs username publicKey id" },
    remoteUrl: "/users",
  };
  let settings = await getSettings();
  let parsedId = parseId(id);
  let object = {};
  let query = { id: id, ...(await generateQuery(userId || null)) };
  let db = dbs[parsedId.type];
  object = await dbs[parsedId.type].db
    .findOne(query)
    .select(dbs[parsedId.type].select);

  return object;
}
