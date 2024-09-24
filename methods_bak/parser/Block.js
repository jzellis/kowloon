import { User } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  activity.summary = `@${user.profile.name} blocked a user`;
  await User.findOneAndUpdate(
    { id: activity.actorId },
    { $push: { blocked: activity.object } }
  );
  return activity;
}
