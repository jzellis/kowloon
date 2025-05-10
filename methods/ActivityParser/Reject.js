import { get } from "https";
import { User } from "../../schema/index.js";
import getObjectById from "../getObjectById.js";
import parseId from "../parseId.js";
export default async function (activity) {
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;
  let user = await User.findOne({ id: activity.actorId });
  let target = await getObjectById(activity.target);

  if (
    user &&
    target &&
    target.pending.some((member) => member.id === activity.actorId)
  ) {
    target.pending = target.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await target.save();
    activity.summary = `@${user.profile.name} rejected an invite to join ${target.name}`;
  }
  return activity;
}
