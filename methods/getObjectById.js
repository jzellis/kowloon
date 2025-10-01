import parseId from "./parseId.js";
import getSettings from "./getSettings.js";
import generateQuery from "./generateQuery.js";
import {
  Activity,
  Post,
  Bookmark,
  Circle,
  Event,
  Group,
  React,
  Reply,
  File,
  User,
} from "../schema/index.js";

export default async function (id, userId = null) {
  if (!id) return false;
  const dbs = {
    Activity: {
      db: Activity,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/activities",
    },
    Post: {
      db: Post,
      select: "-_id -__v -deletedAt -deletedBy -source",
      remoteUrl: "/post",
    },
    Bookmark: {
      db: Bookmark,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/bookmarks",
    },
    Circle: {
      db: Circle,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/circles",
    },
    Event: {
      db: Event,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/events",
    },

    Group: {
      db: Group,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/groups",
    },
    React: {
      db: React,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/reacts",
    },
    Reply: {
      db: Reply,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/replies",
    },
    File: {
      db: File,
      select: "-_id -__v -deletedAt -deletedBy",
      remoteUrl: "/files",
    },
    User: { db: User, select: "-_id profile prefs username publicKey id" },
    remoteUrl: "/users",
  };
  let settings = await getSettings();
  let parsedId = parseId(id);
  let object = {};
  let query = { id };
  let db = dbs[parsedId.type];
  return db ? await dbs[parsedId.type].db.findOne(query) : false;
}
