// This method retrieves a bookmark whether local or remote. Does not return deleted items.

import get from "./get.js";
import { Bookmark } from "../schema/index.js";
export default async function (id) {
  let bookmark;
  bookmark = await Bookmark.findOne({ id, deletedAt: null }).select(
    " -deletedAt -deletedBy -_id -__v -source"
  );
  if (!bookmark) {
    let server = id.split("@")[1];
    let req = await get(`https://${server}/bookmarks/${id}`);
    bookmark = req.bookmark || null;
  }
  return bookmark;
}
