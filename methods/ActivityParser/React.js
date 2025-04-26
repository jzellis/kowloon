import parseId from "../parseId.js";
import getSettings from "../getSettings.js";
import { React, Outbox } from "../../schema/index.js";
import getObjectById from "../getObjectById.js";

export default async function (activity) {
  let item = await getObjectById(activity.target);
  if (item) {
    activity.object.actor = activity.actor;
    activity.object.actorId = activity.actorId;
    let react = await React.create(activity.object);
    activity.objectId = react.id;
    activity.object = react;
    item.reactCount++;
    await item.save();
  }
  return activity;
}
