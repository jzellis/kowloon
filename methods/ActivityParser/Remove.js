import { Post, Bookmark, Circle, Group } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.object });
  let circle = await Circle.findOne({ id: activity.target });
  activity.summary = `@${user.profile.name} removed ${targetUser.profile.name} from ${circle.name}`;
  switch (activity.objectType) {
    case "Circle":
      let circle = await Circle.findOneAndUpdate(
        { id: activity.target },
        { $pullAll: { members: activity.object.actorId } }
      );

      break;

    case "Group":
      let group = await Group.findOneAndUpdate(
        {
          id: activity.target,
          $or: { admins: activity.actorId, actorId: activity.ActorId },
        },
        {
          $pullAll: { pending: activity.object.actorId },
          $pullAll: { members: activity.object.actorId },
        }
      );

      break;
  }
  return activity;
}
