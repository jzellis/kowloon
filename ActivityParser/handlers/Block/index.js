// /ActivityParser/handlers/Block/index.js
import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Block(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Block: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Block: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Block: cannot block yourself" };
    }

    // ---- Load actor & their blocked circle id ----
    const actor = await User.findOne({ id: activity.actorId })
      .select("blocked")
      .lean();
    if (!actor) return { activity, error: "Block: actor not found" };
    if (!actor.blocked) {
      return { activity, error: "Block: blocked circle not configured" };
    }

    // ---- Resolve target & normalize to member subdoc ----
    const targetObj = await objectById(activity.target);
    if (!targetObj) return { activity, error: "Block: target not found" };
    const member = toMember(targetObj);
    if (!member || !member.id) {
      return { activity, error: "Block: invalid target" };
    }

    // ---- Atomic add (only if not already a member), bump memberCount ----
    const res = await Circle.updateOne(
      { id: actor.blocked, "members.id": { $ne: member.id } },
      {
        $push: { members: member },
        $inc: { memberCount: 1 },
      }
    );

    const didAdd = (res.modifiedCount || 0) > 0;
    return {
      activity,
      circleId: actor.blocked,
      blocked: didAdd,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
