import { Group, User } from "../../schema/index.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });
  let approvedUser = await User.findOne({ id: activity.object });

  if (user && group && group.admins.includes(activity.actorId)) {
    if (!group.members.some((member) => member.id === activity.object)) {
      group.members.push({
        id: activity.object,
        serverId: `@${parseId(activity.object).server}`,
        name: approvedUser.profile.name,
        inbox: `https://${parseId(activity.object).server}/users/${
          activity.target
        }/inbox`,
        outbox: `https://${parseId(activity.object).server}/users/${
          activity.target
        }/outbox`,
        icon: user.profile.icon,
        url: `https://${parseId(activity.object).server}/users/${
          activity.target
        }`,
      });
      group.pending = group.pending.filter(
        (member) => member.id !== activity.object
      );
      await group.save();
      activity.summary = `@${user.profile.name} approved ${approvedUser.profile.name}'s request to join ${group.name}`;
    }
  }
  return activity;
}
