import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a file whether local or remote. Does not return deleted items.

export default async function getFile(fileId, opts) {
  assertTypeFromId(fileId, "File");
  return getObjectById(fileId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
