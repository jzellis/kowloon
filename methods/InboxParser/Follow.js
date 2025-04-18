import getUser from "../getUser.js";
import { User, Circle } from "../../schema/index.js";
export default async function (activity) {
  let user = activity.actor;
  let targetUser = await getUser(activity.object);
  targetUser.serverId = activity.object.split("@").slice(1)[1];
  activity.summary = `@${user.profile.name} followed ${targetUser.profile.name}`;

  await Circle.findOneAndUpdate(
    { id: user.following },
    {
      $push: {
        members: {
          id: targetUser.id,
          serverId: `@${targetUser.serverId}`,
          name: targetUser.profile.name,
          inbox: `https://${targetUser.serverId}/users/${targetUser.id}/inbox`,
          outbox: `https://${targetUser.serverId}/users/${targetUser.id}/outbox`,
          icon: targetUser.profile.icon,
          url: `https://${targetUser.serverId}/users/${targetUser.id}`,
        },
      },
    }
  );

  return activity;
}
