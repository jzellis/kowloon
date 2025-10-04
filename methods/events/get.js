import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a event whether local or remote. Does not return deleted items.

export default async function getEvent(eventId, opts) {
  assertTypeFromId(eventId, "Event");
  return getObjectById(eventId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
