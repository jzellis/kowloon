import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
import parseId from "../parseId.js";
export default async function (activity) {
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;
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

    let following = await Circle.findOne({ id: user.following });
    // console.log(circle);
    following.members = circle.members.filter(
      (member) => member.id !== activity.object
    );
    await following.save();
  }
  return activity;
}
