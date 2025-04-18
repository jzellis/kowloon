import parseId from "../parseId.js";
import getSettings from "../getSettings.js";
import { Reply, Outbox } from "../../schema/index.js";

export default async function (activity) {
  activity.objectId = (await Reply.create(activity.object)).id;
  return activity;
}
