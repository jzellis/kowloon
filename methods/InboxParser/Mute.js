import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let blockedUser = await getUser(activity.object);
  blockedUserServer = activity.object.split("@").slice(1)[1];
  activity.summary = `@${user.profile.name} blocked ${activity.object}`;
  await Circle.findOneAndUpdate(
    { id: user.muted },
    {
      $push: {
        members: {
          id: blockedUser.id,
          serverId: `@${blockedUserServer}`,
          type: "kowloon",
          name: blockedUser.profile.name,
          inbox: `https://${blockedUserServer}/users/${blockedUser.id}/inbox`,
          outbox: `https://${blockedUserServer}/users/${blockedUser.id}/outbox`,
          icon: blockedUser.profile.icon,
          url: `https://${blockedUserServer}/users/${blockedUser.id}`,
        },
      },
    }
  );
  return activity;
}
