import { User, Circle } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  activity.summary = `@${user.profile.name} blocked ${activity.object}`;
  await Circle.findOneAndUpdate(
    { id: user.blocked },
    { $push: { members: activity.object } }
  );
  return activity;
}
