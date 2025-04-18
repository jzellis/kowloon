// This method retrieves a group whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Group } from "../schema/index.js";
export default async function (id) {
  let group;
  group = await Group.findOne({ id, deletedAt: null }).select(
    "-flaggedAt -flaggedBy -flaggedReason -approval  -deletedAt -deletedBy -_id -__v -members -admins -pending -banned"
  );
  if (!group) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/groups/${id}`);
    group = req.group || null;
  }
  return group;
}
