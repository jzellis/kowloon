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

import indefinite from "indefinite";
import getUser from "../getUser.js";
import parseId from "../parseId.js";

const dbs = { Post, Bookmark, Circle, Group, React, File, User, Reply };

export default async function (activity) {
  let parsedId = parseId(activity.target);

  let post = await Post.findOne({ id: activity.target });
  post.actor = post.actor || (await getUser(post.actorId));

  let react = await React.create(activity.object);
  if (post) {
    post.reactCount++;
    await post.save();
  }
  activity.objectId = react.id;

  activity.summary = `${actor.profile.name} (${actor.username}) reacted "${
    activity.object.emoji
  }" to ${post.type ? indefinite(post.type) : ""}`;

  return activity;
}
