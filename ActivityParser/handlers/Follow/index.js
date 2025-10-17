// /ActivityParser/handlers/Follow/index.js
import { Circle, User } from "#schema";
import getObjectById from "#methods/get/objectById.js";

function normalizeObjectAsActorId(obj) {
  // Accepts either "@user@domain" or { actorId: "@user@domain" } (and ONLY actorId)
  if (typeof obj === "string") {
    const actorId = obj.trim();
    return actorId ? { actorId } : null;
  }
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
    if (keys.length !== 1 || keys[0] !== "actorId") return null;
    const actorId = String(obj.actorId || "").trim();
    return actorId ? { actorId } : null;
  }
  return null;
}

export default async function Follow(activity) {
  try {
    // ---- Basic validation ----
    if (!activity || typeof activity !== "object") {
      return { activity, error: "Follow: missing activity" };
    }
    const actorId =
      typeof activity.actorId === "string" ? activity.actorId.trim() : "";
    if (!actorId)
      return { activity, error: "Follow: missing activity.actorId" };

    // object must be a string id or {actorId}
    const norm = normalizeObjectAsActorId(activity.object);
    if (!norm) {
      return {
        activity,
        error:
          'Follow: invalid activity.object — expected "@user@domain" or {actorId:"@user@domain"}',
      };
    }
    activity.object = norm; // ensure downstream code always sees an object
    if (norm.actorId === actorId) {
      return { activity, error: "Follow: cannot follow yourself" };
    }

    // ---- Acting user must exist (to read default 'following' circle) ----
    const follower = await User.findOne({ id: actorId }).lean(false);
    if (!follower)
      return { activity, error: `Follow: follower not found: ${actorId}` };

    // target circle: empty string or falsy -> use follower.following
    const requestedTarget =
      typeof activity.target === "string" ? activity.target.trim() : "";
    const circleId = requestedTarget || follower.following;
    if (!circleId)
      return {
        activity,
        error: "Follow: follower has no 'following' circle set",
      };

    const circle = await Circle.findOne({ id: circleId }).lean(false);
    if (!circle)
      return {
        activity,
        error: `Follow: target circle not found: ${circleId}`,
      };
    // MUST be a user-owned circle
    if (circle.actorId !== actorId) {
      return {
        activity,
        error: `Follow: target circle not owned by actor (${circle.actorId} != ${actorId})`,
      };
    }

    // ---- Resolve the followed user (local or remote) ----
    // Uses #methods/get/objectById which will do prefer-local and, if needed, remote resolve+hydrate.
    let resolved = null;
    try {
      const result = await getObjectById(norm.actorId, {
        mode: "prefer-local",
        hydrateRemoteIntoDB: true,
      });
      resolved = result?.object || null;
    } catch (e) {
      // Treat resolution failure as an error (require retrievable user)
      return {
        activity,
        error: `Follow: could not resolve user ${norm.actorId} (${
          e?.message || "lookup failed"
        })`,
      };
    }
    if (!resolved) {
      return { activity, error: `Follow: user not found: ${norm.actorId}` };
    }

    // ---- Build member record from resolved User ----
    const member = {
      id: resolved.id, // always the Kowloon user id: "@user@domain"
      name: resolved?.profile?.name,
      icon: resolved?.profile?.icon,
      url: resolved?.url,
      inbox: resolved?.inbox,
      outbox: resolved?.outbox,
      server: resolved?.server, // ok if undefined for local
    };

    // ---- Insert if not already present (idempotent) ----
    const res = await Circle.updateOne(
      { id: circle.id, actorId, "members.id": { $ne: member.id } },
      { $push: { members: member }, $set: { updatedAt: new Date() } }
    );
    const added = res.modifiedCount > 0;

    // ---- Annotate for downstream/logs ----
    activity.target = circle.id; // the circle we touched
    activity.objectId = member.id; // who we followed
    activity.sideEffects = { circleId: circle.id, memberId: member.id, added };

    return { activity, following: circle, added };
  } catch (err) {
    console.error(err);
    return { activity, error: err?.message || String(err) };
  }
}
