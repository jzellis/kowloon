import { Group, User } from "#schema";
import getUser from "#methods/users/get.js";
import parseKowloonId from "#methods/parse/parseKowloonId.js";

export default async function (activity) {
  let user = await getUser({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });

  if (user && group) {
    if (
      group.private === false &&
      !group.members.some((member) => member.id === activity.actorId)
    ) {
      group.members.push({
        id: user.id,
        serverId: `@${parseKowloonId(activity.actorId).server}`,
        name: user.profile.name,
        inbox: `https://${parseKowloonId(activity.actorId).server}/users/${
          activity.target
        }/inbox`,
        outbox: `https://${parseKowloonId(activity.actorId).server}/users/${
          activity.target
        }/outbox`,
        icon: user.profile.icon,
        url: `https://${parseKowloonId(activity.actorId).server}/users/${
          activity.target
        }`,
      });
    } else {
      if (!group.pending.some((member) => member.id === activity.actorId))
        group.pending.push({
          id: user.id,
          serverId: `@${parseKowloonId(activity.actorId).server}`,
          name: user.profile.name,
          inbox: `https://${parseKowloonId(activity.actorId).server}/users/${
            activity.target
          }/inbox`,
          outbox: `https://${parseKowloonId(activity.actorId).server}/users/${
            activity.target
          }/outbox`,
          icon: user.profile.icon,
          url: `https://${parseKowloonId(activity.actorId).server}/users/${
            activity.target
          }`,
        });
    }
    await group.save();
    activity.summary = `@${user.profile.name} joined ${group.name}`;
  }
  return activity;
}
