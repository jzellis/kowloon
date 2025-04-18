// This method retrieves a activity whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Activity } from "../schema/index.js";
export default async function (id) {
  let activity;
  activity = await Activity.findOne({ id, deletedAt: null }).select(
    "-flaggedAt -flaggedBy -flaggedReason  -deletedAt -deletedBy -_id -__v -source"
  );
  if (!activity) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/activities/${id}`);
    activity = req.activity || null;
  }
  return activity;
}
