import parseId from "./parseId.js";
import { User } from "../schema/index.js";
import getUserMemberships from "./getUserMemberships.js";
export default function () {
  return {
    loggedOut: {
      to: { to: "@public", deletedAt: null },
      replyTo: { replyTo: "@public", deletedAt: null },
      reactTo: { target: "@public", deletedAt: null },
    },
    loggedIn: async (id) => {
      let user = await User.findOne({ id });
      return {
        to: {
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
          deletedAt: null,
        },
        replyTo: {
          replyTo: {
            $in: Array.from(
              new Set([
                user.id,
                "@public",
                `@${parseId(user.id).server}`,
                ...(await user.getMemberships()),
              ])
            ),
          },
          deletedAt: null,
        },
        reactTo: {
          reactTo: {
            $in: Array.from(
              new Set([
                user.id,
                "@public",
                `@${parseId(user.id).server}`,
                ...(await user.getMemberships()),
              ])
            ),
          },
          deletedAt: null,
        },
      };
    },
  };
}
