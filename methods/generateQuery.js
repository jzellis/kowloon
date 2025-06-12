/* This generates a generic query for finding objects for a logged in user. It's used in a lot of places. Since all objects use the same structure, it's easy to have one query to rule them all -- this will work for Activities, Bookmarks, Posts, Circles, Groups and Users. 

It retrieves items addressed to the logged in user, "@public", the user's home server, or any local Groups or Circles the user is a member of, but *not* items from IDs the user has blocked or muted.

*/
import parseId from "./parseId.js";
import { User } from "../schema/index.js";
export default async function (userId) {
  let response = { to: "@public", deletedAt: null };
  let user = await User.findOne({ id: userId });

  if (user)
    response = {
      to: {
        $in: Array.from(
          new Set([
            user.id,
            "@public",
            `@${parseId(user.id).server}`,
            ...(await user.getMemberships()),
          ])
        ),
      },

      actorId: {
        $nin: [...(await user.getBlocked()), ...(await user.getMuted())],
      },
      deletedAt: null,
    };
  return response;
}
