// Block handler (replace the target resolution section with this)

import { Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Block(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Block: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Block: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Block: cannot block yourself" };
    }

    const actor = await User.findOne({ id: activity.actorId })
      .select("blocked")
      .lean();
    if (!actor) return { activity, error: "Block: actor not found" };
    if (!actor.blocked) {
      return { activity, error: "Block: blocked circle not configured" };
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
      return { activity, error: "Block: invalid target" };
    }

    // write to the actor's "blocked" circle
    const res = await Circle.updateOne(
      { id: actor.blocked, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
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
