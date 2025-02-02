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
export default async function (activity) {
  const dbs = { Post, Bookmark, Circle, Group, React, File, User, Reply };
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let item = await dbs[activity.objectType].findOne({
    id: activity.target,
  });
  Object.keys(activity.object).forEach((key) => {
    try {
      switch (true) {
        case typeof item[key] === "object" &&
          item[key] instanceof Array === false:
          item[key] = { ...item[key], ...activity.object[key] };
          break;
        default:
          item[key] = activity.object[key];
          break;
      }
    } catch (e) {
      // console.log(e);
    }
  });
  await item.save();

  activity.summary = `${actor?.profile.name} (${
    actor?.id
  }) updated ${indefinite(activity.objectType)}`;

  return activity;
}
