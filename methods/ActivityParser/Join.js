import { Group, User } from "../../schema/index.js";
import parseId from "../parseId.js";
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
        serverId: `@${parseId(activity.actorId).server}`,
        name: user.profile.name,
        inbox: `https://${parseId(activity.actorId).server}/users/${
          activity.target
        }/inbox`,
        outbox: `https://${parseId(activity.actorId).server}/users/${
          activity.target
        }/outbox`,
        icon: user.profile.icon,
        url: `https://${parseId(activity.actorId).server}/users/${
          activity.target
        }`,
      });
    } else {
      if (!group.pending.some((member) => member.id === activity.actorId))
        group.pending.push({
          id: user.id,
          serverId: `@${parseId(activity.actorId).server}`,
          name: user.profile.name,
          inbox: `https://${parseId(activity.actorId).server}/users/${
            activity.target
          }/inbox`,
          outbox: `https://${parseId(activity.actorId).server}/users/${
            activity.target
          }/outbox`,
          icon: user.profile.icon,
          url: `https://${parseId(activity.actorId).server}/users/${
            activity.target
          }`,
        });
    }
    await group.save();
    activity.summary = `@${user.profile.name} joined ${group.name}`;
  }
  return activity;
}
