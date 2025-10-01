// This method retrieves a file whether local or remote. Does not return deleted items.

import get from "./get.js";
import { File } from "../schema/index.js";
export default async function (id) {
  let file;
  file = await File.findOne({ id, deletedAt: null }).select(
    "-_id -deletedAt -__v"
  );
  if (!file) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/files/${id}`);
    file = req.file || null;
  }
  return file;
}
