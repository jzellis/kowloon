import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a bookmark whether local or remote. Does not return deleted items.

export default async function getBookmark(bookmarkId, opts) {
  assertTypeFromId(bookmarkId, "Bookmark");
  return getObjectById(bookmarkId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
