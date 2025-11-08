// /ActivityParser/handlers/Follow/index.js
import { Circle, User, Server } from "#schema";
import toMember from "#methods/parse/toMember.js";
import kowloonId from "#methods/parse/kowloonId.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";

export default async function Follow(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Follow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return {
        activity,
        error: "Follow: object must be '@user@domain' string",
      };
    }

    const actor = await User.findOne({ id: activity.actorId });
    if (!actor) return { activity, error: "Follow: actor not found" };

    // The person being followed (could be remote user, so may not have User doc)
    const followedUserId = activity.object;
    let userToFollow = await User.findOne({ id: followedUserId });

    // If not found locally, try to fetch from remote server
    if (!userToFollow) {
      try {
        const getObjectById = (await import("#methods/get/objectById.js")).default;
        const result = await getObjectById(followedUserId, {
          viewerId: null, // Public fetch
          mode: "prefer-local",
          hydrateRemoteIntoDB: true, // Cache the user in our DB
          maxStaleSeconds: 3600, // Use cached data if less than 1 hour old
        });
        userToFollow = result?.object;
      } catch (err) {
        // If fetch fails, we'll create a minimal member object below
        console.warn(`Follow: Could not fetch remote user ${followedUserId}:`, err.message);
      }
    }

    // Create member from the followed user (or construct from ID if remote)
    const member = userToFollow
      ? toMember(userToFollow)
      : { id: followedUserId, name: followedUserId, icon: "", inbox: "", outbox: "", url: "" };

    if (!member || !member.id)
      return { activity, error: "Follow: could not resolve member" };

    let targetId = activity.target;
    if (!targetId) {
      const followingCircle = await Circle.findOne({
        id: actor.following,
      });
      targetId = followingCircle?.id;
    }
    if (!targetId) return { activity, error: "Follow: no target circle found" };

    const res = await Circle.updateOne(
      { id: targetId, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );

    const added = !!(res && (res.modifiedCount > 0 || res.upsertedCount > 0));

    // Update Server collection for remote follows
    const followedUser = activity.object; // e.g., @user@remote.domain or @remote.domain
    const parsed = kowloonId(followedUser);

    if (parsed.domain && !isLocalDomain(parsed.domain)) {
      const serverDomain = parsed.domain;
      const remoteActorId = followedUser; // the full ID being followed

      // Check if this is a server follow (@domain) or actor follow (@user@domain)
      const isServerFollow = parsed.type === "Server";

      if (isServerFollow) {
        // Following the server itself - increment serverFollowersCount
        await Server.updateOne(
          { domain: serverDomain },
          {
            $inc: { serverFollowersCount: 1 },
            $setOnInsert: {
              id: `@${serverDomain}`,
              domain: serverDomain,
              createdBy: "follow-handler",
            },
            $set: {
              "scheduler.nextPollAt": new Date(), // trigger immediate poll
              "scheduler.backoffMs": 0, // reset backoff
            },
          },
          { upsert: true }
        );
      } else {
        // Following a specific actor on the remote server - increment refcount
        const currentServer = await Server.findOne({ domain: serverDomain });
        const currentCount =
          currentServer?.actorsRefCount?.get(remoteActorId) || 0;

        await Server.updateOne(
          { domain: serverDomain },
          {
            $set: {
              [`actorsRefCount.${remoteActorId}`]: currentCount + 1,
              "scheduler.nextPollAt": new Date(), // trigger immediate poll
              "scheduler.backoffMs": 0, // reset backoff
            },
            $setOnInsert: {
              id: `@${serverDomain}`,
              domain: serverDomain,
              createdBy: "follow-handler",
            },
          },
          { upsert: true }
        );
      }
    }

    return {
      activity,
      result: {
        status: added ? "followed" : "already_following",
        target: targetId,
      },
    };
  } catch (err) {
    return { activity, error: `Follow: ${err.message}` };
  }
}
