// /ActivityParser/handlers/Remove/index.js
import { Event, Group, Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import getSettings from "#methods/settings/get.js";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import isServerMod from "#methods/auth/isServerMod.js";
import isGroupAdmin from "#methods/groups/isAdmin.js";
import toMember from "#methods/parse/toMember.js";
import isEventAdmin from "#methods/events/isEventAdmin.js";

export default async function Remove(activity) {
  try {
    const settings = await getSettings();

    // ---- Basic validation ----
    if (!activity?.target) {
      return { activity, error: "No target Circle specified" };
    }
    if (!activity.target.startsWith("circle:")) {
      return { activity, error: "Invalid target Circle" };
    }

    // ---- Load target circle ----
    const targetCircle = await Circle.findOne({ id: activity.target });
    if (!targetCircle) {
      return { activity, error: "Target circle not found" };
    }

    // ---- Determine owner type from the circle's actorId ----
    const ownerId = targetCircle?.actorId || "";
    const ownerType = /^event:[^@]+@[^@]+$/.test(ownerId)
      ? "Event"
      : /^group:[^@]+@[^@]+$/.test(ownerId)
      ? "Group"
      : /^@[^@]+@[^@]+$/.test(ownerId)
      ? "User"
      : /^@[^@]+$/.test(ownerId)
      ? "Server"
      : "Unknown";

    // ---- Permissions ----
    switch (ownerType) {
      case "User": {
        if (activity.actorId !== targetCircle.actorId) {
          return { activity, error: "You are not the owner of this circle" };
        }
        break;
      }
      case "Server": {
        // Must be local server's circle
        if (targetCircle.actorId !== settings.actorId) {
          return { activity, error: "Cannot update remote server Circles" };
        }
        if (
          activity.target === settings.adminCircle &&
          !(await isServerAdmin(activity.actorId))
        ) {
          return { activity, error: "You are not a server admin" };
        }
        if (
          activity.target === settings.modCircle &&
          !(await isServerMod(activity.actorId))
        ) {
          return { activity, error: "You are not a server moderator" };
        }
        break;
      }
      case "Group": {
        if (!(await isGroupAdmin(activity.actorId, targetCircle.actorId))) {
          return { activity, error: "You are not a group admin" };
        }
        break;
      }
      case "Event": {
        if (!(await isEventAdmin(activity.actorId, targetCircle.actorId))) {
          return { activity, error: "You are not a event admin" };
        }
        break;
      }
      default: {
        return { activity, error: "Unsupported circle owner type" };
      }
    }

    // ---- Normalize subject (user to remove) into cached actor shape ----
    const member =
      typeof activity.object === "string"
        ? toMember(await objectById(activity.object))
        : toMember(activity.object);

    if (!member || !member.id) {
      return { activity, error: "Remove: invalid object (user to remove)" };
    }

    activity.object = member;

    // ---- Atomic remove (only if present), decrement counter ----
    const res = await Circle.updateOne(
      { id: activity.target, "members.id": activity.object.id },
      {
        $pull: { members: { id: activity.object.id } },
        $inc: { memberCount: -1 },
      }
    );

    return {
      activity,
      circleId: activity.target,
      removed: (res.modifiedCount || 0) > 0,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
