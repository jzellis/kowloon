import { Event, Group, Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";
import getSettings from "#methods/settings/get.js";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import isServerMod from "#methods/auth/isServerMod.js";
import isGroupAdmin from "#methods/groups/isAdmin.js";
import isGroupMod from "#methods/groups/isMod.js";
import toMember from "#methods/parse/toMember.js";
import isEventAdmin from "#methods/events/isEventAdmin.js";

export default async function Add(activity) {
  try {
    let settings = await getSettings();
    if (!activity.target)
      return { activity, error: "No target Circle specified" };
    if (!activity.target.startsWith("circle:"))
      return { activity, error: "Invalid target Circle" };

    let targetCircle = await Circle.findOne({ id: activity.target });
    if (!targetCircle) return { activity, error: "Target circle not found" };

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

    switch (ownerType) {
      case "User":
        if (activity.actorId !== targetCircle.actorId)
          return { activity, error: "You are not the owner of this circle" };
        break;
      case "Server":
        if (targetCircle.actorId != settings.actorId)
          return { activity, error: "Cannot update remote server Circles" };
        if (
          activity.target === settings.adminCircle &&
          !(await isServerAdmin(activity.actorId))
        )
          return { activity, error: "You are not a server admin" };
        if (
          activity.target === settings.modCircle &&
          !(await isServerMod(activity.actorId))
        )
          return { activity, error: "You are not a server moderator" };
        break;
      case "Group":
        if (!(await isGroupAdmin(activity.actorId, targetCircle.actorId)))
          return { activity, error: "You are not a group admin" };
        break;
      case "Event":
        if (!(await isEventAdmin(activity.actorId, targetCircle.actorId)))
          return { activity, error: "You are not a event admin" };
        break;
    }

    const member =
      typeof activity.object === "string"
        ? toMember(await objectById(activity.object))
        : toMember(activity.object);

    if (!member || !member.id) {
      return { activity, error: "Add: invalid object (user to add)" };
    }

    activity.object = member; // normalize the activity payload to the cached actor shape

    let res = await Circle.updateOne(
      { id: activity.target, "members.id": { $ne: activity.object.id } },
      {
        $push: { members: activity.object },
        $inc: { memberCount: 1 },
      }
    );

    return {
      activity,
      circleId: activity.target,
      added: (res.modifiedCount || 0) > 0,
      federate: false,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
