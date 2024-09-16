import { Post, Bookmark, Circle, Group, User } from "../../schema/index.js";

export default async function (activity) {
  activity.public = false;
  let user = await User.findOne({ id: activity.actorId });
  let targetUser = await User.findOne({ id: activity.object });
  let circle = await Circle.findOne({ id: activity.target, actorId: user.id });
  activity.summary = `${user.profile.name} (${$user.username}) added ${activity.object} to ${circle.name}`;
  switch (activity.objectType) {
    case "Circle":
      let circle = await Circle.findOneAndUpdate(
        { id: activity.target },
        { $push: { members: activity.object } }
      );
      break;
  }
  return activity;
}
