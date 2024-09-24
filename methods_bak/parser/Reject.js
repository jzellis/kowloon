import { Group } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.object });
  let group = await Group.findOne({ id: activity.target });
  activity.summary = `@${user.profile.name} rejected ${targetUser.profile.name}'s request to join ${group.name}`;
  switch (activity.objectType) {
    case "Group":
      let group = await Group.findOneAndUpdate(
        {
          id: activity.target,
          $or: { admins: activity.actorId, actorId: activity.ActorId },
        },
        {
          $pullAll: { pending: activity.object },
        }
      );

      break;
  }
  return activity;
}
