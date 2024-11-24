import { User, Circle } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  activity.summary = `@${user.profile.name} unmuted ${activity.object.actorId}`;
  await Circle.findOneAndUpdate(
    { id: user.muted },
    { $pullAll: { members: activity.object.actorId } }
  );
  return activity;
}
