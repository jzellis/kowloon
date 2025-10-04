import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a page whether local or remote. Does not return deleted items.

export default async function getPage(pageId, opts) {
  assertTypeFromId(pageId, "Page");
  return getObjectById(pageId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
