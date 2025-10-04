import { Post } from "#schema";
import indefinite from "indefinite";
import getObjectById from "#utils/getObjectById.js";
import parseKowloonId from "#methods/parse/parseKowloonId.js";

export default async function (activity) {
  let target = getObjectById(activity.target);
  let to = getObjectById(activity.to);
  if ((to || target) && activity.objectType === "Post") {
    let post = await Post.findOneAndUpdate(
      { id: activity.object.id },
      { $set: activity.object },
      { new: true, upsert: true }
    );
    activity.objectId = post.id;
    activity.object = post;
    activity.summary = `${activity.actor?.profile?.name} (${
      activity.actorId
    }) posted ${indefinite(activity.object.type)} in ${target.name}`;
  }

  return activity;
}
