// /ActivityParser/handlers/Mute/index.js

import { Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Mute(activity) {
  try {
    // ---- Validation ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Mute: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return { activity, error: "Mute: missing or malformed activity.target" };
    }
    if (activity.target === activity.actorId) {
      return { activity, error: "Mute: cannot mute yourself" };
    }

    // ---- Load actor and their muted circle ----
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

    // ---- Build member record ----
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
      // already present or circle vanished
      updatedCircle = await Circle.findOne({ id: circle.id });
      if (!updatedCircle) {
        return {
          activity,
          error: `Mute: circle disappeared during update: ${circle.id}`,
        };
      }
    }

    // ---- Annotate for Undo and downstream use ----
    activity.objectId = member.id; // who was muted
    activity.target = updatedCircle.id; // which circle was used
    activity.sideEffects = {
      circleId: updatedCircle.id,
      memberId: member.id,
    };

    // Federation hint: mute is local-only unless you want to federate later
    return {
      activity,
      circle: updatedCircle,
      added,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
