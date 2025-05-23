import { User } from "../../schema/index.js";
import parseId from "../parseId.js";
import getObjectById from "../getObjectById.js";
import { get } from "https";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let target = await getObjectById(activity.target);

  if (
    user &&
    target &&
    target.pending.some((member) => member.id === activity.actorId) &&
    !target.members.some((member) => member.id === activity.actorId)
  ) {
    target.members.push({
      id: activity.actorId,
      serverId: `@${parseId(activity.actorId).server}`,
      name: user.profile.name,
      inbox: `https://${parseId(activity.actorId).server}/users/${
        activity.target23
      }/inbox`,
      outbox: `https://${parseId(activity.actorId).server}/users/${
        activity.target
      }/outbox`,
      icon: user.profile.icon,
      url: `https://${parseId(activity.actorId).server}/users/${
        activity.target
      }`,
    });
    target.pending = target.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await target.save();
    activity.summary = `@${user.profile.name} joined ${target.name}`;
  }
  return activity;
}
