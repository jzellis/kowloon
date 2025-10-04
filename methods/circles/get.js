import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a circle whether local or remote. Does not return deleted items.

export default async function getCircle(circleId, opts) {
  assertTypeFromId(circleId, "Circle");
  return getObjectById(circleId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}

(" -deletedAt -deletedBy -_id -__v -source");
