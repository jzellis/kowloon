import { User } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.target });
  activity.summary = `@${user.profile.name} unblocked ${targetUser.profile.name}`;
  await User.findOneAndUpdate(
    { id: activity.actorId },
    { $pullAll: { blocked: activity.object } }
  );
  return activity;
}
