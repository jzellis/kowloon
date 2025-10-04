import { Group, User } from "#schema";
import parseKowloonId from "#methods/parse/parseKowloonId.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });

  if (
    user &&
    group &&
    group.members.some((member) => member.id === activity.actorId)
  ) {
    group.members = group.members.filter(
      (member) => member.id !== activity.actorId
    );
    await group.save();
    activity.summary = `@${user.profile.name} left ${group.name}`;
  }
  return activity;
}
