import getObjectById from "../getObjectById.js";
import { User } from "../../schema/index.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let item = await getObjectById(activity.target);
  if (
    !item.deletedAt &&
    (item.actorId == activity.actorId || user?.isAdmin === true)
  ) {
    item.flaggedAt = new Date();
    item.flaggedBy = activity.actorId;
    item.flaggedReason = activity.object || "";
    await item.save();
  }

  return activity;
}
