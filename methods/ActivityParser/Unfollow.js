import { React, User, Post } from "../../schema/index.js";

export default async function (activity) {
  let actor = await User.findOne({ id: activity.actorId });
  let circle = await Circle.findOne({ id: activity.target });
  activity.summary = `@${actor.profile.name} unfollowed ${circle.name}`;
  circle.members = circle.members.filter(
    (member) => member.id !== activity.object
  );
  await circle.save();
  return activity;
}
