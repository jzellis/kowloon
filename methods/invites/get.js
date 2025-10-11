import getObjectById from "#methods/get/objectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a invite whether local or remote. Does not return deleted items.

export default async function getInvite(inviteId, opts) {
  assertTypeFromId(inviteId, "Invite");
  return getObjectById(inviteId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
