import getObjectById from "../getObjectById.js";
import indefinite from "indefinite";
export default async function (activity) {
  if (!activity.target) return new Error("No target provided");
  if (!activity.object) return new Error("No object provided");

  let user = activity.actor;
  let item = await getObjectById(activity.target);

  // Is the item the actor or does the item belong to the actor or is the item a group which the actor is an admin of and has it been updated
  if (
    (item.id === activity.actorId ||
      item.actorId == activity.actorId ||
      (item.objectType === "Group" &&
        item.admins.includes(activity.actorId))) &&
    new Date(activity.updatedAt).getTime() < Date.now() - 10 * 1000 // Has it been updated in the last ten seconds?
  ) {
    if (item.objectType === "User") {
      item.isAdmin = false;
    }
    for (const [key, value] of Object.entries(activity.object)) {
      item[key] = value;
    }
    await item.save();

    activity.summary = `${user.profile?.name} (${activity.actor?.id}) updated ${
      user.profile.pronouns.possAdj
    } ${item.objectType === "User" ? "profile" : item.type}`;
  }
  return activity;
}
