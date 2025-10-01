// This method retrieves a circle whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Circle } from "../schema/index.js";
export default async function (id) {
  let circle;
  circle = await Circle.findOne({ id, deletedAt: null }).select(
    " -deletedAt -deletedBy -_id -__v -source"
  );
  if (!circle) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/circles/${id}`);
    circle = req.circle || null;
  }
  return circle;
}
