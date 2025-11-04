// /ActivityParser/handlers/Unfollow/index.js
import { Circle, User, Server } from "#schema";
import toMember from "#methods/parse/toMember.js";
import kowloonId from "#methods/parse/kowloonId.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";

export default async function Unfollow(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Unfollow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return {
        activity,
        error: "Unfollow: object must be '@user@domain' string",
      };
    }

    const actor = await User.findOne({ id: activity.actorId });
    if (!actor) return { activity, error: "Unfollow: actor not found" };

    const member = toMember(actor);
    if (!member || !member.id)
      return { activity, error: "Unfollow: could not resolve member" };

    let targetId = activity.target;
    if (!targetId) {
      const followingCircle = await Circle.findOne({
        "owner.id": actor.id,
        subtype: "Following",
      });
      targetId = followingCircle?.id;
    }
    if (!targetId)
      return { activity, error: "Unfollow: no target circle found" };

    const res = await Circle.updateOne(
      { id: targetId, "members.id": member.id },
      { $pull: { members: { id: member.id } }, $inc: { memberCount: -1 } }
    );

    const removed = !!(res && res.modifiedCount > 0);

    // Update Server collection for remote unfollows
    const unfollowedUser = activity.object; // e.g., @user@remote.domain or @remote.domain
    const parsed = kowloonId(unfollowedUser);

    if (parsed.domain && !isLocalDomain(parsed.domain)) {
      const serverDomain = parsed.domain;
      const remoteActorId = unfollowedUser;

      // Check if this is a server unfollow (@domain) or actor unfollow (@user@domain)
      const isServerUnfollow = parsed.type === "Server";

      if (isServerUnfollow) {
        // Unfollowing the server itself - decrement serverFollowersCount
        const serverUpdateRes = await Server.updateOne(
          { domain: serverDomain },
          { $inc: { serverFollowersCount: -1 } }
        );

        // Ensure count doesn't go negative
        if (serverUpdateRes.modifiedCount > 0) {
          await Server.updateOne(
            { domain: serverDomain, serverFollowersCount: { $lt: 0 } },
            { $set: { serverFollowersCount: 0 } }
          );
        }
      } else {
        // Unfollowing a specific actor - decrement refcount
        const currentServer = await Server.findOne({ domain: serverDomain });
        const currentCount = currentServer?.actorsRefCount?.get(remoteActorId) || 0;
        const newCount = Math.max(0, currentCount - 1);

        if (newCount === 0) {
          // Remove the key entirely when count reaches 0
          await Server.updateOne(
            { domain: serverDomain },
            { $unset: { [`actorsRefCount.${remoteActorId}`]: "" } }
          );
        } else {
          // Decrement the count
          await Server.updateOne(
            { domain: serverDomain },
            { $set: { [`actorsRefCount.${remoteActorId}`]: newCount } }
          );
        }
      }

      // Check if we should pause polling (no one follows anything on this server)
      const server = await Server.findOne({ domain: serverDomain });
      if (
        server &&
        (!server.actorsRefCount || server.actorsRefCount.size === 0) &&
        server.serverFollowersCount === 0
      ) {
        // No local interest in this server - set next poll far in future or disable
        await Server.updateOne(
          { domain: serverDomain },
          {
            $set: {
              "scheduler.nextPollAt": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
              "scheduler.backoffMs": 86400000, // 1 day backoff
            },
          }
        );
      }
    }

    return {
      activity,
      result: {
        status: removed ? "unfollowed" : "not_following",
        target: targetId,
      },
    };
  } catch (err) {
    return { activity, error: `Unfollow: ${err.message}` };
  }
}
