// /ActivityParser/handlers/Follow/index.js
import { Circle, User, Server } from "#schema";
import toMember from "#methods/parse/toMember.js";
import kowloonId from "#methods/parse/kowloonId.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import createNotification from "#methods/notifications/create.js";
import { getSetting } from "#methods/settings/cache.js";

/**
 * Type-specific validation for Follow activities
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Follow: missing activity.actorId");
  }

  const hasTarget = (activity?.target && typeof activity.target === "string") ||
                    (activity?.object && typeof activity.object === "string");

  if (!hasTarget) {
    errors.push("Follow: missing required field 'object' (User/Server ID to follow)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for outbound Follow activity.
 * (Inbound follows are handled by handleInboundFollow; they send Accept directly.)
 */
export async function getFederationTargets(activity, result) {
  const followedUserId = activity.object;
  if (!followedUserId) return { shouldFederate: false };

  // Determine if the followed user is remote
  let remoteInbox = null;
  const parsed = kowloonId(followedUserId);

  if (parsed?.domain && !isLocalDomain(parsed.domain)) {
    // Remote user follow: send the Follow activity to their server
    // Use inbox from the member object if we just looked it up
    remoteInbox = result?.member?.inbox ?? null;

    if (remoteInbox) {
      return {
        shouldFederate: true,
        scope: "direct",
        inboxes: [remoteInbox],
      };
    }

    // Fallback: server-level follow
    return {
      shouldFederate: true,
      scope: "domain",
      domains: [parsed.domain],
    };
  }

  return { shouldFederate: false };
}

// ---------------------------------------------------------------------------
// Fetch a remote actor's public profile (for building a member record)
// ---------------------------------------------------------------------------
async function fetchRemoteActor(actorId) {
  if (!actorId?.startsWith("http")) return null;
  try {
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(actorId, {
      headers: { Accept: "application/activity+json, application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const raw = await res.json();
    // Unwrap Kowloon API envelope if needed
    return raw?.item ?? raw;
  } catch {
    return null;
  }
}

function remoteActorToMember(actorId, doc) {
  if (!doc) {
    return { id: actorId, name: actorId, icon: "", inbox: "", outbox: "", url: "", server: "" };
  }
  try {
    const url = new URL(actorId);
    const domain = url.hostname;
    return {
      id: actorId,
      name: doc.name ?? doc.preferredUsername ?? doc.username ?? actorId,
      icon: (typeof doc.icon === "object" ? doc.icon?.url : doc.icon) ?? doc.profile?.icon ?? "",
      inbox: doc.inbox ?? `https://${domain}/users/${encodeURIComponent(actorId)}/inbox`,
      outbox: doc.outbox ?? "",
      url: doc.url ?? actorId,
      server: `@${domain}`,
    };
  } catch {
    return { id: actorId, name: actorId, icon: "", inbox: "", outbox: "", url: "", server: "" };
  }
}

// ---------------------------------------------------------------------------
// Inbound Follow: remote actor follows one of our local users
// ---------------------------------------------------------------------------
async function handleInboundFollow(activity) {
  const remoteActorId = activity.actorId;
  const localUserTarget = activity.object; // URL or @handle@domain of our local user

  // Find the local user being followed (try actorId URL first, then handle)
  let localUser = await User.findOne({ actorId: localUserTarget }).lean();
  if (!localUser) localUser = await User.findOne({ id: localUserTarget }).lean();
  if (!localUser) {
    // Try extracting username from URL like https://domain/users/alice
    try {
      const url = new URL(localUserTarget);
      const username = url.pathname.split("/").filter(Boolean).pop();
      if (username) localUser = await User.findOne({ username }).lean();
    } catch {
      // Not a URL
    }
  }
  if (!localUser) {
    return { activity, error: `Follow: local user not found for ${localUserTarget}` };
  }

  // Resolve the remote actor's HTTP URL if we only have internal @user@domain format
  let remoteActorUrl = remoteActorId;
  if (!remoteActorUrl.startsWith("http") && typeof activity.actor === "object" && activity.actor?.id?.startsWith("http")) {
    remoteActorUrl = activity.actor.id;
  } else if (!remoteActorUrl.startsWith("http")) {
    // Derive from @user@domain → https://domain/users/user
    const m = remoteActorUrl.match(/^@([^@]+)@(.+)$/);
    if (m) remoteActorUrl = `https://${m[2]}/users/${m[1]}`;
  }

  // Fetch the remote actor's profile to get name/icon/inbox
  const remoteDoc = await fetchRemoteActor(remoteActorUrl);
  const remoteMember = remoteActorToMember(remoteActorUrl, remoteDoc);

  // Ensure internal-format actorId is kept for DB storage (not the derived URL)
  remoteMember.id = remoteActorId;

  // Find or create the local user's "Followers" circle
  let followersCircle = await Circle.findOne({
    actorId: localUser.id,
    name: "Followers",
  });
  if (!followersCircle) {
    followersCircle = await Circle.create({
      type: "System",
      name: "Followers",
      actorId: localUser.id,
      description: "People who follow this account",
      to: localUser.id,
      canReply: localUser.id,
      canReact: localUser.id,
    });
  }

  // Add the remote actor to the followers circle (idempotent)
  const addRes = await Circle.updateOne(
    { id: followersCircle.id, "members.id": { $ne: remoteActorId } },
    { $push: { members: remoteMember }, $inc: { memberCount: 1 } }
  );
  const added = !!(addRes?.modifiedCount > 0);

  // Create a follow notification for the local user
  if (added) {
    try {
      const wantsNotification = localUser.prefs?.notifications?.follow !== false;
      if (wantsNotification) {
        await createNotification({
          type: "follow",
          recipientId: localUser.id,
          actorId: remoteActorId,
          objectId: remoteActorId,
          objectType: "User",
          activityId: activity.remoteId ?? activity.id,
          activityType: "Follow",
          groupKey: `follow:${localUser.id}:${remoteActorId}`,
        });
      }
    } catch (err) {
      console.error("inbound Follow: notification failed:", err.message);
    }
  }

  // Send Accept{Follow} back — fire and forget
  const domain = getSetting("domain");
  const localActorUrl = localUser.actorId ?? `https://${domain}/users/${localUser.username}`;
  // Try to get inbox from: fetched doc > actor object in activity > derive from URL
  const remoteInbox = remoteMember.inbox
    || remoteDoc?.inbox
    || (typeof activity.actor === "object" ? activity.actor?.inbox : null);

  queueMicrotask(async () => {
    try {
      const { default: sendAccept } = await import("#methods/federation/sendAccept.js");
      await sendAccept({
        localActorUrl,
        remoteActorId: remoteActorUrl, // use URL for HTTP lookup
        remoteInbox,
        followActivityId: activity.remoteId ?? activity.id,
      });
    } catch (err) {
      console.error("inbound Follow: sendAccept failed:", err.message);
    }
  });

  return {
    activity,
    created: {
      status: added ? "follower_added" : "already_follower",
      followersCircle: followersCircle.id,
      member: remoteMember,
    },
    result: { status: added ? "follower_added" : "already_follower" },
    federation: { shouldFederate: false }, // Accept is sent directly above
  };
}

// ---------------------------------------------------------------------------
// Outbound Follow: local user follows someone (possibly remote)
// ---------------------------------------------------------------------------
async function handleOutboundFollow(activity) {
  const actor = await User.findOne({ id: activity.actorId });
  if (!actor) return { activity, error: "Follow: actor not found" };

  const followedUserId = activity.object;
  const localUser = await User.findOne({ id: followedUserId });

  let member;
  if (localUser) {
    member = toMember(localUser);
  } else {
    // Remote user: try fetching their AP profile
    const remoteDoc = await fetchRemoteActor(followedUserId).catch(() => null);
    member = remoteActorToMember(followedUserId, remoteDoc);
  }

  if (!member?.id) return { activity, error: "Follow: could not resolve member" };

  let targetId = activity.target;
  if (!targetId) targetId = actor.circles?.following;
  if (!targetId) return { activity, error: "Follow: no target circle found" };

  const targetCircle = await Circle.findOne({ id: targetId }).select("actorId").lean();
  if (!targetCircle) return { activity, error: "Follow: target circle not found" };
  if (targetCircle.actorId !== activity.actorId) {
    return { activity, error: "Follow: you can only follow into your own circles" };
  }

  const res = await Circle.updateOne(
    { id: targetId, "members.id": { $ne: member.id } },
    { $push: { members: member }, $inc: { memberCount: 1 } }
  );
  const added = !!(res?.modifiedCount > 0 || res?.upsertedCount > 0);

  // Create notification for local users being followed
  if (added && localUser) {
    try {
      const wantsNotification = localUser.prefs?.notifications?.follow !== false;
      if (wantsNotification) {
        await createNotification({
          type: "follow",
          recipientId: followedUserId,
          actorId: activity.actorId,
          objectId: activity.actorId,
          objectType: "User",
          activityId: activity.id,
          activityType: "Follow",
          groupKey: `follow:${followedUserId}:${activity.actorId}`,
        });
      }
    } catch (err) {
      console.error("Follow: notification failed:", err.message);
    }
  }

  // Update Server refcount for remote follows
  const parsed = kowloonId(followedUserId);
  if (parsed.domain && !isLocalDomain(parsed.domain)) {
    const serverDomain = parsed.domain;
    const isServerFollow = parsed.type === "Server";

    if (isServerFollow) {
      await Server.updateOne(
        { domain: serverDomain },
        {
          $inc: { serverFollowersCount: 1 },
          $setOnInsert: { id: `@${serverDomain}`, domain: serverDomain, createdBy: "follow-handler" },
          $set: { "scheduler.nextPollAt": new Date(), "scheduler.backoffMs": 0 },
        },
        { upsert: true }
      );
    } else {
      // actorsRefCount is an array of { id, count } — Mongoose Map was
      // unusable because actor IDs contain dots (e.g. @user@domain.tld)
      // which Mongoose/MongoDB treat as nested-path separators.
      const existing = await Server.findOne({ domain: serverDomain });
      if (existing) {
        const entry = existing.actorsRefCount?.find(e => e.id === followedUserId);
        if (entry) {
          await Server.updateOne(
            { domain: serverDomain, "actorsRefCount.id": followedUserId },
            {
              $inc: { "actorsRefCount.$.count": 1 },
              $set: { "scheduler.nextPollAt": new Date(), "scheduler.backoffMs": 0 },
            }
          );
        } else {
          await Server.updateOne(
            { domain: serverDomain },
            {
              $push: { actorsRefCount: { id: followedUserId, count: 1 } },
              $set: { "scheduler.nextPollAt": new Date(), "scheduler.backoffMs": 0 },
            }
          );
        }
      } else {
        await Server.create({
          id: `@${serverDomain}`,
          domain: serverDomain,
          createdBy: "follow-handler",
          actorsRefCount: [{ id: followedUserId, count: 1 }],
          "scheduler.nextPollAt": new Date(),
          "scheduler.backoffMs": 0,
        });
      }
    }
  }

  const result = { status: added ? "followed" : "already_following", target: targetId, member };
  const federation = await getFederationTargets(activity, result);

  return { activity, created: result, result, federation };
}

// ---------------------------------------------------------------------------
// Main handler: dispatch based on direction
// ---------------------------------------------------------------------------
export default async function Follow(activity) {
  try {
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    // Inbound federated follow: remote actor is following one of our local users
    // Detected by: federated flag + _inboundFollow marker set by normalizer, OR
    // actorId is a URL (remote) and object looks local
    if (activity.federated && activity._inboundFollow) {
      return handleInboundFollow(activity);
    }

    // Also detect inbound follows by checking if actorId is a URL
    // (remote actor) and object is a local user
    if (activity.federated && activity.actorId?.startsWith("http")) {
      // Check if the object is a local user
      const domain = getSetting("domain");
      const objectStr = String(activity.object ?? "");
      const objectIsLocal = objectStr.includes(domain) || objectStr.includes(`@${domain}`);
      if (objectIsLocal) {
        return handleInboundFollow(activity);
      }
    }

    // Outbound follow: local user is following someone
    return handleOutboundFollow(activity);
  } catch (err) {
    return { activity, error: `Follow: ${err.message}` };
  }
}
