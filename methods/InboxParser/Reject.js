import { Group, User } from "../../schema/index.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });

  if (
    user &&
    group &&
    group.pending.some((member) => member.id === activity.actorId) &&
    (user.id === activity.actorId || group.admins.includes(user.id))
  ) {
    group.pending = group.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await group.save();
    activity.summary = `@${user.profile.name} rejected an invite to join ${group.name}`;
  }
  return activity;
}
