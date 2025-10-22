// /ActivityParser/handlers/Mute/index.js
import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Mute(activity) {
  try {
    // ---- Validate basics ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Mute: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Mute: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Mute: cannot mute yourself" };
    }

    // ---- Load actor & their muteed circle id ----
    const actor = await User.findOne({ id: activity.actorId })
      .select("muteed")
      .lean();
    if (!actor) return { activity, error: "Mute: actor not found" };
    if (!actor.muteed) {
      return { activity, error: "Mute: muteed circle not configured" };
    }

    // ---- Resolve target & normalize to member subdoc ----
    const targetObj = await objectById(activity.target);
    if (!targetObj) return { activity, error: "Mute: target not found" };
    const member = toMember(targetObj);
    if (!member || !member.id) {
      return { activity, error: "Mute: invalid target" };
    }

    // ---- Atomic add (only if not already a member), bump memberCount ----
    const res = await Circle.updateOne(
      { id: actor.muteed, "members.id": { $ne: member.id } },
      {
        $push: { members: member },
        $inc: { memberCount: 1 },
      }
    );

    const didAdd = (res.modifiedCount || 0) > 0;
    return {
      activity,
      circleId: actor.muteed,
      muteed: didAdd,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
