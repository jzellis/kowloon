/* This generates a generic query for finding objects for a logged in user. It's used in a lot of places. Since all objects use the same structure, it's easy to have one query to rule them all -- this will work for Activities, Bookmarks, Posts, Circles, Groups and Users. 

It retrieves items addressed to the logged in user, "@public", the user's home server, or any local Groups or Circles the user is a member of, but *not* items from IDs the user has blocked or muted.

*/
import parseKowloonId from "#methods/parse/parseKowloonId.js";
export default async function (user) {
  let response = user
    ? {
        actorId: { $nin: [...user.blocked, ...user.muted] },
        $or: [
          {
            to: {
              $in: Array.from(
                new Set([
                  user.id,
                  "@public",
                  `@${parseKowloonId(user.id).server}`,
                  ...user.memberships,
                ])
              ),
            },
          },
          { actorId: user.id },
        ],

        deletedAt: null,
      }
    : { to: "@public", deletedAt: null };

  return response;
}
