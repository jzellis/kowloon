// /ActivityParser/handlers/Follow/index.js
import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Follow(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Follow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return {
        activity,
        error:
          "Follow: missing or malformed activity.object (actorId to follow)",
      };
    }

    // ---- Load actor & resolve target circle ----
    const actor = await User.findOne({ id: activity.actorId }).lean();
    if (!actor) return { activity, error: "Follow: actor not found" };

    const target = activity.target || actor.following;
    if (!target || typeof target !== "string") {
      return {
        activity,
        error:
          "Follow: no target circle provided and no default following circle on actor",
      };
    }
    if (!target.startsWith("circle:")) {
      return { activity, error: "Follow: target must be a circle id" };
    }

    // ---- Load target circle and enforce ownership (actors may only edit their own circles) ----
    const targetCircle = await Circle.findOne({ id: target }).lean();
    if (!targetCircle)
      return { activity, error: "Follow: target circle not found" };
    if (targetCircle.actorId !== actor.id) {
      return {
        activity,
        error: "Follow: cannot add members to a circle you do not own",
      };
    }

    // ---- Prevent self-follow ----
    if (activity.object === activity.actorId) {
      return { activity, error: "Follow: cannot follow yourself" };
    }

    // ---- Resolve followed object & normalize to circle member subdoc ----
    const followedObj = await objectById(activity.object);
    if (!followedObj) {
      return { activity, error: "Follow: followed object not found" };
    }
    const member = toMember(followedObj);
    if (!member || !member.id) {
      return { activity, error: "Follow: invalid followed object" };
    }

    // ---- Atomic add (only if not already a member), bump memberCount ----
    const res = await Circle.updateOne(
      { id: target, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );

    const didAdd = (res.modifiedCount || 0) > 0;
    return {
      activity,
      circleId: target,
      followed: didAdd,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
