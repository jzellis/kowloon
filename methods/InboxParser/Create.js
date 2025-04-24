import {
  Post,
  Bookmark,
  Circle,
  Group,
  File,
  Feed,
  User,
  Reply,
  Settings,
  Activity,
} from "../../schema/index.js";
import indefinite from "indefinite";
import getObjectById from "../getObjectById.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let target = activity.target ? parseId(activity.target) : null;
  let targetObject = getObjectById(activity.target);
  if (targetObject) {
    activity = await Activity.findOneAndUpdate(
      { id: activity.id },
      { $set: activity },
      { new: true, upsert: true }
    );
  }

  return activity;
}
