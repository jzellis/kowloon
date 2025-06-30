import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
import parseId from "../parseId.js";
export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await getUser(activity.object);
  let parsedTargetId = parseId(activity.object);
  targetUser.serverId = activity.object.split("@").slice(1)[1];
  activity.summary = `@${user.profile.name} followed ${targetUser.profile.name}`;
  let circleId = activity.target || user.following;
  await Circle.findOneAndUpdate(
    { id: circleId },
    {
      $push: {
        members: {
          id: activity.object,
          serverId: `@${parsedTargetId.server}`,
          name: targetUser.profile.name,
          inbox: `https://${parsedTargetId.server}/users/${targetUser.id}/inbox`,
          outbox: `https://${parsedTargetId.server}/users/${targetUser.id}/outbox`,
          icon: targetUser.profile.icon,
          url: `https://${parsedTargetId.server}/users/${targetUser.id}`,
        },
      },
    }
  );

  if (activity.target != user.following) {
    let existing = await Circle.findOne({
      id: user.following,
      "members.id": activity.object,
    });
    if (!existing)
      await Circle.findOneAndUpdate(
        { id: user.following },
        {
          $push: {
            members: {
              id: activity.object,
              serverId: `@${parsedTargetId.server}`,
              name: targetUser.profile.name,
              inbox: `https://${parsedTargetId.server}/users/${targetUser.id}/inbox`,
              outbox: `https://${parsedTargetId.server}/users/${targetUser.id}/outbox`,
              icon: targetUser.profile.icon,
              url: `https://${parsedTargetId.server}/users/${targetUser.id}`,
            },
          },
        }
      );
  }
  return activity;
}
