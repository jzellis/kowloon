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

    // The person being followed
    const followedUserId = activity.object;
    const localUser = await User.findOne({ id: followedUserId });

    let member;
    if (localUser) {
      // Local user - use toMember
      member = toMember(localUser);
    } else {
      // Remote user - fetch their public profile and create member
      try {
        const parsed = kowloonId(followedUserId);

        if (parsed?.domain) {
          // Fetch from remote /resolve endpoint
          const url = `https://${parsed.domain}/resolve?id=${encodeURIComponent(followedUserId)}`;
          const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });

          if (response.ok) {
            const remoteUser = await response.json();
            member = {
              id: followedUserId,
              name: remoteUser.profile?.name || remoteUser.username || followedUserId,
              icon: remoteUser.profile?.icon || "",
              inbox: remoteUser.inbox || `https://${parsed.domain}/users/${encodeURIComponent(followedUserId)}/inbox`,
              outbox: remoteUser.outbox || `https://${parsed.domain}/users/${encodeURIComponent(followedUserId)}/outbox`,
              url: remoteUser.url || `https://${parsed.domain}/users/${encodeURIComponent(followedUserId)}`,
              server: `@${parsed.domain}`,
            };
          }
        }
      } catch (err) {
        console.warn(`Follow: Could not fetch remote user ${followedUserId}:`, err.message);
      }

      // Fallback if fetch failed
      if (!member) {
        member = {
          id: followedUserId,
          name: followedUserId,
          icon: "",
          inbox: "",
          outbox: "",
          url: "",
          server: "",
        };
      }
    }

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
