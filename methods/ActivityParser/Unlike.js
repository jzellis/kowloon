import { Like, User, Post } from "../../schema/index.js";

export default async function (activity) {
  let actor = activity.actor || (await User.findOne({ id: activity.actorId }));
  let target = await Post.findOne({ id: activity.target });
  activity.summary = `${actor.profile.name} (${actor.username}) unliked ${
    target.type ? "a " + target.type : ""
  }`;

  let like = await Like.findOneAndDelete({
    actorId: activity.actorId,
    target: activity.target,
  });
  activity.objectId = like.id;

  await Post.findOneAndUpdate(
    { id: activity.target },
    { $inc: { likeCount: -1 } }
  );

  return activity;
}
