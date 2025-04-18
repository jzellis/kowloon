// This method retrieves a react whether local or remote. Does not return deleted items.

import get from "./get.js";
import { React } from "../schema/index.js";
export default async function (id) {
  let react;
  react = await React.findOne({ id, deletedAt: null });
  if (!react) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/reacts/${id}`);
    react = req.react || null;
  }
  return react;
}
