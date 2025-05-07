import parseId from "../parseId.js";
import getSettings from "../getSettings.js";
import { Reply, Outbox } from "../../schema/index.js";
import getObjectById from "../getObjectById.js";

export default async function (activity) {
  let item = await getObjectById(activity.target);
  if (item) {
    activity.object.actor = activity.actor;
    activity.object.targetActorId = item.actorId;
    let reply = await Reply.create(activity.object);
    activity.objectId = reply.id;
    activity.object = reply;
    item.replyCount++;
    await item.save();
  }
  return activity;
}
