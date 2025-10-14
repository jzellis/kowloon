import { Group, User } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });

  if (user && group) {
    if (
      group.private === false &&
      !group.members.some((member) => member.id === activity.actorId)
    ) {
      group.members.push({
        id: user.id,
        serverId: `@${kowloonId(activity.actorId).server}`,
        name: user.profile.name,
        inbox: `https://${kowloonId(activity.actorId).server}/users/${
          activity.target
        }/inbox`,
        outbox: `https://${kowloonId(activity.actorId).server}/users/${
          activity.target
        }/outbox`,
        icon: user.profile.icon,
        url: `https://${kowloonId(activity.actorId).server}/users/${
          activity.target
        }`,
      });
    } else {
      if (!group.pending.some((member) => member.id === activity.actorId))
        group.pending.push({
          id: user.id,
          serverId: `@${kowloonId(activity.actorId).server}`,
          name: user.profile.name,
          inbox: `https://${kowloonId(activity.actorId).server}/users/${
            activity.target
          }/inbox`,
          outbox: `https://${kowloonId(activity.actorId).server}/users/${
            activity.target
          }/outbox`,
          icon: user.profile.icon,
          url: `https://${kowloonId(activity.actorId).server}/users/${
            activity.target
          }`,
        });
    }
    await group.save();
    activity.summary = `@${user.profile.name} joined ${group.name}`;
  }
  return activity;
}
