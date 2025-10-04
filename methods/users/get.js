import getObjectById from "#utils/getObjectById.js";
export default async function getUser(userId, opts) {
  assertTypeFromId(userId, "User");
  return await getObjectById(userId, {
    select: "-password -resetToken -resetTokenExpiresAt",
    ...opts,
  });
}
