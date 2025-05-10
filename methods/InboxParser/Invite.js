import { User } from "../../schema/index.js";
import getObjectById from "../getObjectById.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let target = await getObjectById(activity.target);
  let invitedUser = await User.findOne({ id: activity.object });

  if (
    user &&
    target &&
    !target.members.some((member) => member.id === activity.object) &&
    !target.pending.some((member) => member.id === activity.object)
  ) {
    target.pending.push({
      id: activity.object,
      serverId: `@${parseId(activity.object).server}`,
      name: invitedUser.profile.name,
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

    await target.save();
    activity.summary = `@${user.profile.name} invited ${invitedUser.profile.name} to join ${target.name}`;
  }
  return activity;
}
