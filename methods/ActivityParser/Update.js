import getObjectById from "../getObjectById.js";
import indefinite from "indefinite";
export default async function (activity) {
  if (!activity.target) throw new Error("No target provided");
  if (!activity.object) throw new Error("No object provided");

  let item = await getObjectById(activity.target);

  if (item.actorId == activity.actorId) {
    for (const [key, value] of Object.entries(activity.object)) {
      item[key] = value;
    }
    await item.save();

    activity.summary = `${activity.actor?.profile?.name} (${activity.actor?.id}) updated ${activity.actor.profile.pronouns.possAdj} ${item.type}`;
  }
  return activity;
}
