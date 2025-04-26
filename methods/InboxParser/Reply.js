import { Reply, Circle } from "../../schema/index.js";

import getObjectById from "../getObjectById.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let item = await getObjectById(activity.target);
  if (item) {
    activity.object.actor = activity.object.actor || activity.actor;
    let reply = await Reply.findOneAndUpdate(
      { id: activity.object.id },
      { $set: activity.object }, //activity.object,
      { new: true, upsert: true }
    );
    activity.objectId = reply.id;
    activity.object = reply;
    if (reply?.lastErrorObject?.upserted) item.replyCount++; // If the reply isn't already in the db, increment the original object's replyCount
    await item.save();
  }
  return activity;
}
