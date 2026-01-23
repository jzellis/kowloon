// Mute handler (replace the target resolution section with this)

import { Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Mute(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Mute: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Mute: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Mute: cannot mute yourself" };
    }

    const actor = await User.findOne({ id: activity.actorId })
      .select("muted")
      .lean();
    if (!actor) return { activity, error: "Mute: actor not found" };
    if (!actor.muted) {
      return { activity, error: "Mute: muted circle not configured" };
    }

    // --- normalize target to a member (accepts @user@domain or DB id) ---
    async function resolveTargetToMember(ref) {
      const isActorId = (s) => /^@[^@]+@[^@]+$/.test(s);
      if (typeof ref === "string") {
        const s = ref.trim();
        if (isActorId(s)) {
          const u = await User.findOne({ id: s }).lean();
          // if the user isn't local, still build a minimal member from actorId
          return toMember(u || { actorId: s });
        }
        // not an actorId → try DB id lookup
        const obj = await getObjectById(s);
        return toMember(obj);
      }
      return null;
    }

    const member = await resolveTargetToMember(activity.target);
    if (!member || !member.id) {
      return { activity, error: "Mute: invalid target" };
    }

    // write to the actor's "muted" circle
    const res = await Circle.updateOne(
      { id: actor.muted, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );
    const didAdd = (res.modifiedCount || 0) > 0;

    return {
      activity,
      circleId: actor.muted,
      muted: didAdd,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
