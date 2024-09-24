import { Like, Settings, Outbox } from "../../schema/index.js";
import post from "../post.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let type =
    activity.target.split(":")[0].charAt(0).toUpperCase() +
    activity.target.split(":")[0].substring(1).toLowerCase();

  activity.summary = `@${user.profile.name} unliked ${
    "aeiouAEIOU".indexOf(type) !== -1 ? "an" : "a"
  } ${type}`;
  let like = await Like.deleteOne({
    id: activity.target,
    actorId: activity.actorId,
  });
  let domain = (await Settings.findOne({ name: "server" })).value;
  let targetDomain = activity.target.split("@").slice(-1);
  if (targetDomain === domain) {
  } else {
    let url = `https://${targetDomain}/api/inbox`;
    let response = await post(url, {
      actorId: activity.actorId,
      body: { activity },
    });
    activity.objectId = response.activity.id;
  }
  return activity;
}
