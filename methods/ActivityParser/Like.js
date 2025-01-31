import { React, User, Post } from "../../schema/index.js";

import indefinite from "indefinite";

export default async function (activity) {
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let target = await Post.findOne({ id: activity.target });
  activity.summary = `${actor.profile.name} (${actor.username}) liked ${
    target.type ? indefinite(target.type) : ""
  }`;

  let like = await React.create({
    actorId: activity.actorId,
    target: activity.target,
    type: activity.object.type,
  });
  activity.objectId = like.id;

  await Post.findOneAndUpdate(
    { id: activity.target },
    { $inc: { reactCount: 1 } }
  );

  return activity;
}
