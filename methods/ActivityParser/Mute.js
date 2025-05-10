import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
import parseId from "../parseId.js";

export default async function (activity) {
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;
  let user = await User.findOne({ id: activity.actorId });
  let blockedUser = await getUser(activity.target);
  if (blockedUser) {
    let blockedUserServer = parseId(activity.target).server;
    activity.summary = `@${user.profile.name} muted ${blockedUser.profile.name}`;
    await Circle.findOneAndUpdate(
      { id: user.muted },
      {
        $push: {
          members: {
            id: activity.target,
            serverId: `@${blockedUserServer}`,
            type: "kowloon",
            name: blockedUser.profile.name,
            inbox: `https://${blockedUserServer}/users/${activity.target}/inbox`,
            outbox: `https://${blockedUserServer}/users/${activity.target}/outbox`,
            icon: blockedUser.profile.icon,
            url: `https://${blockedUserServer}/users/${activity.target}`,
          },
        },
      }
    );
  } else {
    activity.error = new Error("User not found");
  }
  return activity;
}
