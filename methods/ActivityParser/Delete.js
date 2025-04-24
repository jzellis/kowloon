import getObjectById from "../getObjectById.js";
import { User } from "../../schema/index.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let item = await getObjectById(activity.target);
  if (
    !item.deletedAt &&
    (item.actorId == activity.actorId || user?.isAdmin === true)
  ) {
    item.deletedAt = new Date();
    item.deletedBy = activity.actorId;
    await item.save();
  }

  return activity;
}
