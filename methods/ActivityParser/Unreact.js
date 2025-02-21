import { React, User, Post } from "../../schema/index.js";

export default async function (activity) {
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let target = await Post.findOne({ id: activity.target });
  activity.summary = `${actor.profile.name} (${actor.username}) unreactd ${
    target.type ? "a " + target.type : ""
  }`;

  let react = await React.findOneAndDelete({
    actorId: activity.actorId,
    target: activity.target,
  });
  activity.objectId = react.id;

  await Post.findOneAndUpdate(
    { id: activity.target },
    { $inc: { reactCount: -1 } }
  );

  return activity;
}
