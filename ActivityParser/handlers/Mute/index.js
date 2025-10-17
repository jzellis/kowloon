// /ActivityParser/handlers/Mute/index.js

import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

// Extract the user being muted from `object` (preferred) or legacy `target`
function pickMemberId(activity) {
  const obj = activity?.object;
  if (typeof obj === "string" && obj.trim()) return obj.trim();
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const v = (obj.actorId ?? "").toString().trim();
    if (v) return v;
  }
  if (typeof activity?.target === "string" && activity.target.trim()) {
    return activity.target.trim(); // legacy
  }
  return null;
}

export default async function Mute(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Mute: missing activity.actorId" };
    }

    const memberId = pickMemberId(activity);
    if (!memberId) {
      return {
        activity,
        error: 'Mute requires object ("@user@domain" or {actorId})',
      };
    }

    if (memberId === activity.actorId) {
      return { activity, error: "Mute: cannot mute yourself" };
    }

    // Actor & their "muted" circle
    const actor = await User.findOne({ id: activity.actorId });
    if (!actor) {
      return { activity, error: `Mute: user not found: ${activity.actorId}` };
    }
    const circleId = actor.muted;
    if (!circleId) {
      return { activity, error: "Mute: user has no 'muted' circle set" };
    }

    let circle = await Circle.findOne({ id: circleId });
    if (!circle) {
      return { activity, error: `Mute: muted circle not found: ${circleId}` };
    }

    // Build a member subdoc (local if we can resolve, otherwise remote stub)
    const local = await objectById(memberId).catch(() => null);
    const parsed = kowloonId(memberId);

    const member = local
      ? {
          id: local.id,
          name: local?.profile?.name,
          url: local?.url,
          inbox: local?.inbox,
          outbox: local?.outbox,
          server: local?.server ?? parsed?.domain,
        }
      : {
          id: memberId,
          url: parsed?.type === "URL" ? memberId : undefined,
          server: parsed?.domain,
        };

    // Idempotent add
    const res = await Circle.updateOne(
      { id: circle.id, "members.id": { $ne: member.id } },
      { $addToSet: { members: member } }
    );

    const updatedCircle = await Circle.findOne({ id: circle.id });
    const added = res.modifiedCount > 0;

    // Annotate for downstream/Undo
    activity.objectId = member.id; // who was muted
    activity.target = updatedCircle.id; // which circle did the mute
    activity.sideEffects = {
      circleId: updatedCircle.id,
      memberId: member.id,
    };

    return { activity, circle: updatedCircle, added, federate: false };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
