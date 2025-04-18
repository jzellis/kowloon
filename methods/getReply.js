// This method retrieves a reply whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Reply } from "../schema/index.js";
export default async function (id) {
  let reply;
  reply = await Reply.findOne({ id, deletedAt: null });
  if (!reply) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/replies/${id}`);
    reply = req.reply || null;
  }
  return reply;
}
