import { User, Circle } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  activity.summary = `@${user.profile.name} unblocked ${activity.object}`;
  await Circle.findOneAndUpdate(
    { id: user.blocked },
    { $pullAll: { members: activity.object } }
  );
  return activity;
}
