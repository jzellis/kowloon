import { Post, Bookmark, Circle, Group, User } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.object.actorId });
  let circle = await Circle.findOne({ id: activity.target, actorId: user.id });
  activity.summary = `${user.profile.name} (${user.id}) added ${targetUser?.profile?.name} (${targetUser.id}) to ${user.profile.pronouns.possAdj} Circle ${circle.name}`;
  switch (activity.objectType) {
    case "Circle":
      let circle = await Circle.findOneAndUpdate(
        { id: activity.target },
        { $push: { members: activity.object.actorId } }
      );
      break;

    case "Group":
      let group = await Group.findOne({ id: activity.target });
      if (group.requiresUserApproval) {
        group.pending.push(activity.object.actorId);
      } else {
        group.members.push(activity.object.actorId);
      }
      await group.save();
      break;
  }
  return activity;
}
