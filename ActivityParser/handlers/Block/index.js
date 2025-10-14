import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Block(activity) {
  try {
    // ---- Validation ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Block: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Block: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Block: cannot block yourself" };
    }

    // ---- Load actor and blocked circle ----
    const actor = await User.findOne({ id: activity.actorId });
    if (!actor)
      return { activity, error: `Block: user not found: ${activity.actorId}` };

    const circleId = actor.blocked;
    if (!circleId)
      return { activity, error: "Block: user has no 'blocked' circle set" };

    let circle = await Circle.findOne({ id: circleId });
    if (!circle)
      return {
        activity,
        error: `Block: blocked circle not found: ${circleId}`,
      };

    // ---- Build member entry ----
    const memberId = activity.target;
    const local = await objectById(memberId);
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

    // ---- Add only if not already present ----
    const filter = { id: circle.id, "members.id": { $ne: member.id } };
    const update = {
      $push: { members: member },
      $set: { updatedAt: new Date() },
    };
    const opts = { new: true };

    let updatedCircle = await Circle.findOneAndUpdate(filter, update, opts);
    let added = false;

    if (updatedCircle) {
      added = true;
    } else {
      updatedCircle = await Circle.findOne({ id: circle.id });
      if (!updatedCircle)
        return {
          activity,
          error: `Block: circle disappeared during update: ${circle.id}`,
        };
    }

    // ---- Annotate for Undo ----
    activity.objectId = member.id; // who was blocked
    activity.sideEffects = {
      circleId: updatedCircle.id,
      memberId: member.id,
    };

    // Block is local-only (no federation unless you later federate Block)
    return { activity, circle: updatedCircle, added, federate: false };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
