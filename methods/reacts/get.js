import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a react whether local or remote. Does not return deleted items.

export default async function getReact(reactId, opts) {
  assertTypeFromId(reactId, "React");
  return getObjectById(reactId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
