import { React, User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
export default async function (activity) {
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;
  try {
    let user = await User.findOne({ id: activity.actorId });
    let blockedUser = await getUser(activity.target);
    let circle = await Circle.findOne({ id: user.muted });
    activity.summary = `@${user.profile.name} unblocked ${blockedUser.profile.name}`;
    circle.members = circle.members.filter(
      (member) => member.id !== activity.target
    );
    await circle.save();
    return activity;
  } catch (e) {
    console.log(e);
  }
}
