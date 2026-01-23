import getObjectById from "#methods/core/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a inbox whether local or remote. Does not return deleted items.

export default async function getInbox(inboxId, opts) {
  assertTypeFromId(inboxId, "Inbox");
  return getObjectById(inboxId, { opts });
}
