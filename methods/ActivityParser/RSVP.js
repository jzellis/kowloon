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
    target.invited.some((member) => member.id === activity.actorId) &&
    !target.attending.some((member) => member.id === activity.actorId)
  ) {
    target.attending.push({
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
      status: activity.object,
    });
    target.invited = target.invited.filter(
      (member) => member.id !== activity.actorId
    );
    await target.save();
    activity.summary = `@${
      user.profile.name
    } is ${activity.object.toLowerCase()} ${target.name}`;
  }
  return activity;
}
