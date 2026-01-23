// /ActivityParser/handlers/Remove/index.js
import { Event, Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
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
    // Normalize the "user to add" so we accept:
    //  1) "@user@domain" (actorId string)
    //  2) { actorId: "@user@domain" }
    //  3) DB id / full object (legacy paths)
    async function resolveActorToMember(ref) {
      // String case
      if (typeof ref === "string") {
        const s = ref.trim();
        if (/^@[^@]+@[^@]+$/.test(s)) {
          // actorId string → try local User, else fall back to minimal actor ref
          const u = await User.findOne({ id: s }).lean();
          return toMember(u || { actorId: s });
        }
        // not an actorId string → treat as DB id / other resolvable id
        const o = await getObjectById(s);
        return toMember(o);
      }

      // Object case
      if (ref && typeof ref === "object") {
        if (
          typeof ref.actorId === "string" &&
          /^@[^@]+@[^@]+$/.test(ref.actorId)
        ) {
          const s = ref.actorId.trim();
          const u = await User.findOne({ id: s }).lean();
          return toMember(u || { actorId: s });
        }
        // If it already looks like a User/Actor object, let toMember handle it
        return toMember(ref);
      }

      return null;
    }

    const member = await resolveActorToMember(activity.object);

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
