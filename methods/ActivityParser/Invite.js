import { Group, User } from "../../schema/index.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.object });
  let group = await Group.findOne({ id: activity.target });
  activity.summary = `${actor.profile.name} (${actor.id}) invited ${targetUser.profile.name} (${targetUser.id}) to join ${group.name}`;
  switch (activity.objectType) {
    case "Group":
      let group = await Group.findOneAndUpdate(
        {
          id: activity.target,
          $or: { admins: activity.actorId, actorId: activity.ActorId },
        },
        {
          $push: { pending: activity.object.actorId },
        }
      );

      break;
  }
  return activity;
}
