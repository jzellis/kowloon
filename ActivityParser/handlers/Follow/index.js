// /ActivityParser/handlers/Follow/index.js

import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { Circle, User } from "#schema";

export default async function Follow(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Follow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return {
        activity,
        error: "Follow: missing or malformed activity.object (id to follow)",
      };
    }
    if (activity.target && typeof activity.target !== "string") {
      return {
        activity,
        error: "Follow: malformed activity.target (circle id)",
      };
    }

    // ---- Load follower & resolve destination circle ----
    const follower = await User.findOne({ id: activity.actorId });
    if (!follower) {
      return {
        activity,
        error: `Follow: follower not found: ${activity.actorId}`,
      };
    }

    // if target provided, use it; else default to follower.following circle
    const circleId = activity.target || follower.following;
    if (!circleId) {
      return {
        activity,
        error: "Follow: follower has no 'following' circle set",
      };
    }

    let circle = await Circle.findOne({ id: circleId });
    if (!circle) {
      return {
        activity,
        error: `Follow: target circle not found: ${circleId}`,
      };
    }

    // ---- Resolve the entity being followed (local vs remote) ----
    const targetId = activity.object;
    const followed = await objectById(targetId); // null if remote/unknown
    const parsed = kowloonId(targetId); // { type, domain, ... } or { type:"URL", domain }

    // ---- Optional guard: self-follow doesn't make sense
    if (targetId === activity.actorId) {
      return { activity, error: "Follow: cannot follow yourself" };
    }

    // ---- Build Member subdoc (minimal if not found locally) ----
    const member = followed
      ? {
          id: followed.id,
          name: followed?.profile?.name,
          inbox: followed?.inbox,
          outbox: followed?.outbox,
          url: followed?.url,
          server: followed?.server ?? parsed?.domain,
        }
      : {
          id: targetId,
          url: parsed?.type === "URL" ? targetId : undefined,
          server: parsed?.domain,
        };

    // ---- Add only if not already present (no duplicates) ----
    const filter = { id: circle.id, "members.id": { $ne: member.id } };
    const update = {
      $push: { members: member },
      $set: { updatedAt: new Date() },
    };
    const opts = { new: true };

    let updatedCircle = await Circle.findOneAndUpdate(filter, update, opts);
    let added = false;

    if (updatedCircle) {
      added = true; // actually inserted
    } else {
      // Member already existed or circle vanished (very unlikely). Fetch current circle.
      updatedCircle = await Circle.findOne({ id: circle.id });
      if (!updatedCircle) {
        return {
          activity,
          error: `Follow: circle disappeared during update: ${circle.id}`,
        };
      }
    }

    // ---- Annotate activity for downstreams + Undo ----
    activity.target = updatedCircle.id; // ensure target reflects the circle we touched
    activity.objectId = member.id; // who we followed
    activity.sideEffects = {
      circleId: updatedCircle.id,
      memberId: member.id,
    };

    // Federate if the followed entity appears remote
    const federate = !followed && Boolean(parsed?.domain);

    return {
      activity,
      following: updatedCircle,
      added,
      federate,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
