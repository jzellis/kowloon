import getObjectById from "#methods/get/objectById.js";
import assertTypeFromId from "#utils/assertTypeFromId.js";

export default async function getPost(postId, opts) {
  assertTypeFromId(postId, "Post");
  return getObjectById(postId, {
    select: "id type title actorId createdAt",
    ...opts,
  });
}
