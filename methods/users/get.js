import getObjectById from "#methods/get/objectById.js";
import assertTypeFromId from "#methods/utils/assertTypeFromId.js";
export default async function getUser(userId, opts) {
  assertTypeFromId(userId, "User");
  return await getObjectById(userId, {
    select: "type objectType username email profile publicKey",
    ...opts,
  });
}
