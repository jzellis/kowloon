import getObjectById from "#utils/getObjectById.js";
import { User } from "#schema";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let item = await getObjectById(activity.target);
  if (item.actorId == activity.actorId || (user && user.isAdmin === true)) {
    item.deletedAt = new Date();
    item.deletedBy = activity.actorId;
    await item.save();
  }

  return activity;
}
