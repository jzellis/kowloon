import { Like, Settings, Outbox } from "../../../schema/index.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let type =
    activity.target.split(":")[0].charAt(0).toUpperCase() +
    activity.target.split(":")[0].substring(1).toLowerCase();

  activity.summary = `@${user.profile.name} liked ${
    "aeiouAEIOU".indexOf(type) !== -1 ? "an" : "a"
  } ${type}`;
  let like = await Like.create({
    actorId: activity.actorId,
    target: activity.target,
    type: activity.object,
  });
  activity.objectId = like.id;
  let domain = (await Settings.findOne({ name: "server" })).value;
  let targetDomain = activity.target.split("@").slice(-1);
  if (targetDomain != domain) {
    await Outbox.create({
      actorId: activity.actorId,
      to: activity.target,
      item: activity.object,
    });
  }
  return activity;
}
