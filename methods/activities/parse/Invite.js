import { Group, User } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });
  let invitedUser = await User.findOne({ id: activity.object });

  if (
    user &&
    group &&
    !group.members.some((member) => member.id === activity.object) &&
    !group.pending.some((member) => member.id === activity.object)
  ) {
    group.pending.push({
      id: activity.object,
      serverId: `@${kowloonId(activity.object).server}`,
      name: invitedUser.profile.name,
      inbox: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }/outbox`,
      icon: user.profile.icon,
      url: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }`,
    });

    await group.save();
    activity.summary = `@${user.profile.name} invited ${invitedUser.profile.name} to join ${group.name}`;
  }
  return activity;
}
