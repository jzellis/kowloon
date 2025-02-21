import { React, User, Post } from "../../schema/index.js";

import indefinite from "indefinite";

export default async function (activity) {
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let post = await Post.findOne({ id: activity.target });
  activity.summary = `${actor.profile.name} (${actor.username}) reactd ${
    post.type ? indefinite(post.type) : ""
  }`;

  let react = await React.create(activity.object);
  post.reactCount++;
  await post.save();
  activity.objectId = react.id;

  await Post.findOneAndUpdate(
    { id: activity.target },
    { $inc: { reactCount: 1 } }
  );

  return activity;
}
