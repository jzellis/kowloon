// /ActivityParser/handlers/Remove/index.js
import { Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import getSettings from "#methods/settings/get.js";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import isServerMod from "#methods/auth/isServerMod.js";
import isGroupAdmin from "#methods/groups/isAdmin.js";
import toMember from "#methods/parse/toMember.js";

export default async function Remove(activity) {
  try {
    const settings = await getSettings();

    // Support two patterns:
    // 1. Legacy: target = circle ID (explicit circle)
    // 2. New: to = group ID, target = optional circle ID (defaults to members)
    let targetCircle;
    let ownerId;
    let ownerType;

    if (activity.to && /^group:[^@]+@[^@]+$/.test(activity.to)) {
      // New pattern: to = groupId, target = optional specific circle
      const group = await Group.findOne({ id: activity.to }).select("circles").lean();
      if (!group) return { activity, error: "Group not found" };

      ownerId = activity.to;
      ownerType = "Group";

      // If target is specified, verify it belongs to this group
      if (activity.target) {
        if (!activity.target.startsWith("circle:"))
          return { activity, error: "Invalid target Circle" };

        // Verify the target circle belongs to this group
        const circleIds = Object.values(group.circles || {});
        if (!circleIds.includes(activity.target)) {
          return { activity, error: "Target circle does not belong to this group" };
        }

        targetCircle = await Circle.findOne({ id: activity.target });
        if (!targetCircle) return { activity, error: "Target circle not found" };
      } else {
        // Default to members circle
        if (!group.circles?.members) {
          return { activity, error: "Group members circle not found" };
        }
        targetCircle = await Circle.findOne({ id: group.circles.members });
        if (!targetCircle) return { activity, error: "Group members circle not found" };
        activity.target = group.circles.members; // Set for downstream code
      }
    } else {
      // Legacy pattern: target = circle ID
      if (!activity?.target) {
        return { activity, error: "No target Circle specified" };
      }
      if (!activity.target.startsWith("circle:")) {
        return { activity, error: "Invalid target Circle" };
      }

      targetCircle = await Circle.findOne({ id: activity.target });
      if (!targetCircle) {
        return { activity, error: "Target circle not found" };
      }

      ownerId = targetCircle?.actorId || "";
      ownerType = /^group:[^@]+@[^@]+$/.test(ownerId)
        ? "Group"
        : /^@[^@]+@[^@]+$/.test(ownerId)
        ? "User"
        : /^@[^@]+$/.test(ownerId)
        ? "Server"
        : "Unknown";
    }

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

    let removed = (res.modifiedCount || 0) > 0;

    // If removing from a Group and not found in target circle, try pending circle
    if (ownerType === "Group" && !removed) {
      const group = await Group.findOne({ id: ownerId }).select("circles").lean();
      if (group?.circles?.pending) {
        const pendingRes = await Circle.updateOne(
          { id: group.circles.pending, "members.id": activity.object.id },
          {
            $pull: { members: { id: activity.object.id } },
            $inc: { memberCount: -1 },
          }
        );
        removed = (pendingRes.modifiedCount || 0) > 0;
      }
    }

    return {
      activity,
      circleId: activity.target,
      removed,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
