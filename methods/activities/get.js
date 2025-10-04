import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";
// This method retrieves a activity whether local or remote. Does not return deleted items.

export default async function get(activityId, opts) {
  assertTypeFromId(activityId, "Activity");
  return getObjectById(activityId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
