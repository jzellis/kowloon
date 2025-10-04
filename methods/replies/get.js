import getObjectById from "#utils/getObjectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

// This method retrieves a reply whether local or remote. Does not return deleted items.

export default async function getReply(replyId, opts) {
  assertTypeFromId(replyId, "Reply");
  return getObjectById(replyId, {
    select: " -deletedAt -deletedBy -_id -__v -source",
    ...opts,
  });
}
