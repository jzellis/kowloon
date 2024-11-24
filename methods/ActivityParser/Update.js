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
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let item = await dbs[activity.objectType].findOne({
    id: activity.target,
  });
  Object.keys(activity.object).forEach((key) => {
    console.log("Key: ", key, "Type: ", typeof item[key]);
    try {
      switch (true) {
        case item[key] instanceof Object:
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

  activity.summary = `${actor?.profile.name} (${actor?.id}) updated a ${activity.objectType}`;

  return activity;
}
