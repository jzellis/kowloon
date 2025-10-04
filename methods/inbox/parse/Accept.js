import { Group, User } from "#schema";
import parseKowloonId from "#methods/parse/parseKowloonId.js";

export default async function (activity) {
  let group = await Group.findOne({ id: activity.target });

  if (
    activity.actor &&
    group &&
    group.pending.some((member) => member.id === activity.actorId) &&
    !group.members.some((member) => member.id === activity.actorId)
  ) {
    group.members.push({
      id: activity.actorId,
      serverId: `@${parseKowloonId(activity.actorId).server}`,
      name: activity.actor.profile.name,
      inbox: `https://${parseKowloonId(activity.actorId).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${parseKowloonId(activity.actorId).server}/users/${
        activity.target
      }/outbox`,
      icon: activity.actor.profile.icon,
      url: `https://${parseKowloonId(activity.actorId).server}/users/${
        activity.target
      }`,
    });
    group.pending = group.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await group.save();
    activity.summary = `@${activity.actor.profile.name} joined ${group.name}`;
  }
  return activity;
}
