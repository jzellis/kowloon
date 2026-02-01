// Unblock handler - removes a user from the actor's blocked circle

import { Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Unblock(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Unblock: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Unblock: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Unblock: cannot unblock yourself" };
    }

    const actor = await User.findOne({ id: activity.actorId })
      .select("circles.blocked")
      .lean();
    if (!actor) return { activity, error: "Unblock: actor not found" };
    if (!actor.circles?.blocked) {
      return { activity, error: "Unblock: blocked circle not configured" };
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
      return { activity, error: "Unblock: invalid target" };
    }

    // remove from the actor's "blocked" circle
    const res = await Circle.updateOne(
      { id: actor.circles.blocked },
      { $pull: { members: { id: member.id } }, $inc: { memberCount: -1 } }
    );
    const didRemove = (res.modifiedCount || 0) > 0;

    return {
      activity,
      circleId: actor.circles.blocked,
      unblocked: didRemove,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
