import { User } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let mutedUser = await User.findOne({ id: activity.target });

  activity.summary = `@${user.profile.name} unmuted ${mutedUser.profile.name}`;
  await User.findOneAndUpdate(
    { id: activity.actorId },
    { $pullAll: { muted: activity.object } }
  );
  return activity;
}
