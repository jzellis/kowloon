import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a group whether local or remote. Does not return deleted items.

export default async function getGroup(groupId, opts) {
  assertTypeFromId(groupId, "Group");
  return getObjectById(groupId, {
    select: "-approval -pending -banned",
    ...opts,
  });
}
