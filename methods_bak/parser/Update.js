import {
  Post,
  Bookmark,
  Circle,
  Group,
  User,
  Outbox,
} from "../../schema/index.js";

export default async function (activity) {
  activity.summary = `@${user.profile.name} updated ${
    "aeiouAEIOU".indexOf(activity.objectType[0]) !== -1 ? "an" : "a"
  } ${activity.objectType}`;
  switch (activity.objectType) {
    case "Post":
      let originalPost = await Post.findOne({
        id: activity.target,
        actorId: activity.actorId,
        deletedAt: null,
      });
      if (originalPost) {
        await Post.findOneAndUpdate(
          { id: activity.target },
          { $set: activity.object }
        );
      }
      break;

    case "Reply":
      activity.object.actorId = activity.actorId;
      let domain = (await Settings.findOne({ name: "server" })).value;
      let targetDomain = activity.target.split("@").slice(-1);
      if (targetDomain != domain) {
        let url = `https://${targetDomain}/api/inbox`;
        let response = await post(url, {
          actorId: activity.actorId,
          body: { activity },
        });
        activity.objectId = response.activity.id;
      } else {
        const reply = await Post.findOneAndUpdate(
          { id: activity.objectId },
          activity.object
        );
      }
      break;

    case "Bookmark":
      let originalBookmark = await Bookmark.findOne({
        id: activity.target,
        actorId: activity.actorId,
        deletedAt: null,
      });
      if (originalBookmark) {
        await Bookmark.findOneAndUpdate(
          { id: activity.target },
          { $set: activity.object }
        );
      }
      break;

    case "Circle":
      let originalCircle = await Circle.findOne({
        id: activity.target,
        actorId: activity.actorId,
        deletedAt: null,
      });
      if (originalCircle && originalCircle.actor == activity.actorId) {
        originalCircle = { ...originalCircle, ...activity.object };
        await Circle.findOneAndUpdate(
          { id: activity.target },
          { $set: activity.object }
        );
      }
      break;
    case "Group":
      let originalGroup = await Group.findOne({
        id: activity.target,
        $or: [{ actorId: activity.actorId }, { admins: activity.actorId }],
      });
      if (originalGroup)
        await Group.findOneAndUpdate(
          { id: activity.target },
          { $set: activity.object }
        );
      break;

    case "User":
      let originalUser = await User.findOne({
        id: activity.actorId,
      });
      if (originalUser)
        User.findOneAndUpdate(
          { id: activity.actorId },
          { $set: activity.object }
        );
      break;
  }

  return activity;
}
