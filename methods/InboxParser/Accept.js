import { Group, User } from "../../schema/index.js";
import parseId from "../parseId.js";
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
      serverId: `@${parseId(activity.actorId).server}`,
      name: activity.actor.profile.name,
      inbox: `https://${parseId(activity.actorId).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${parseId(activity.actorId).server}/users/${
        activity.target
      }/outbox`,
      icon: activity.actor.profile.icon,
      url: `https://${parseId(activity.actorId).server}/users/${
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
