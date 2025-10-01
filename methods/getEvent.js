// This method retrieves a event whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Event } from "../schema/index.js";
export default async function (id) {
  let event;
  event = await Event.findOne({ id, deletedAt: null }).select(
    " -deletedAt -deletedBy -_id -__v -source"
  );
  if (!event) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/events/${id}`);
    event = req.event || null;
  }
  return event;
}
