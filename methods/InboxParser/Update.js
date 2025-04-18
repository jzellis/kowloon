import {
  Post,
  Bookmark,
  Circle,
  Group,
  File,
  Feed,
  User,
  Reply,
  React,
  Settings,
} from "../../schema/index.js";
import indefinite from "indefinite";
export default async function (activity) {
  if (!activity.target) return new Error("No target provided");
  if (!activity.object) return new Error("No object provided");

  activity.summary = `${actor?.profile?.name} (${actor?.id}) updated ${
    actor.profile.pronouns.possAdj
  } ${indefinite(activity.objectType)}`;

  switch (activity.objectType) {
    case "Post":
      await Post.findByIdAndUpdate(
        { id: activity.target },
        { $set: activity.object }
      );
      break;
  }

  switch (activity.objectType) {
    case "Group":
      await Group.findByIdAndUpdate(
        { id: activity.target },
        { $set: activity.object }
      );
      break;
  }

  switch (activity.objectType) {
    case "Circle":
      await Circle.findByIdAndUpdate(
        { id: activity.target },
        { $set: activity.object }
      );
      break;
  }

  switch (activity.objectType) {
    case "Reply":
      await Reply.findByIdAndUpdate(
        { id: activity.target },
        { $set: activity.object }
      );
      break;
  }

  switch (activity.objectType) {
    case "React":
      await React.findByIdAndUpdate(
        { id: activity.target },
        { $set: activity.object }
      );
      break;
  }

  return activity;
}
