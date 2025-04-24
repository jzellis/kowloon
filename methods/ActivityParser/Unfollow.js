import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await getUser(activity.object);
  let parsedTargetId = parseId(activity.object);
  targetUser.serverId = activity.object.split("@").slice(1)[1];
  activity.summary = `@${user.profile.name} unfollowed ${targetUser.profile.name}`;
  if (activity.target) {
    let circle = await Circle.findOne({ id: activity.target });
    // console.log(circle);
    circle.members = circle.members.filter(
      (member) => member.id !== activity.object
    );
    await circle.save();
  }
  return activity;
}
