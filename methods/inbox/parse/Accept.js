import { Group, User } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";

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
      serverId: `@${kowloonId(activity.actorId).server}`,
      name: activity.actor.profile.name,
      inbox: `https://${kowloonId(activity.actorId).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${kowloonId(activity.actorId).server}/users/${
        activity.target
      }/outbox`,
      icon: activity.actor.profile.icon,
      url: `https://${kowloonId(activity.actorId).server}/users/${
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
