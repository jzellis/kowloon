import {
  Activity,
  Bookmark,
  Post,
  Circle,
  Group,
  Outbox,
} from "../../../schema/index.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  activity.summary = `@${user.profile.name} deleted ${
    "aeiouAEIOU".indexOf(activity.objectType[0]) !== -1 ? "an" : "a"
  } ${activity.objectType}`;
  let target;
  switch (activity.objectType) {
    // If it's a Post

    case "Post":
      target = await Post.findOneAndUpdate(
        { id: activity.target, actorId: activity.actorId, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            formerType: "$type",
            type: "Tombstone",
          },
        }
      );
      if (target) activity.objectId = target.id;
      break;

    case "Activity":
      target = await Activity.findOneAndUpdate(
        { id: activity.target, actorId: activity.actorId, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            formerType: "$type",
            type: "Tombstone",
          },
        }
      );
      if (target) activity.objectId = target.id;
      break;

    case "Circle":
      target = await Circle.findOneAndUpdate(
        { id: activity.target, actorId: activity.actorId, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            formerType: "$type",
            type: "Tombstone",
          },
        }
      );
      if (target) activity.objectId = target.id;
      break;

    case "Bookmark":
      target = await Bookmark.findOneAndUpdate(
        { id: activity.target, actorId: activity.actorId, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
          },
        }
      );
      if (target) activity.objectId = target.id;
      break;

    case "Group":
      target = await Group.findOneAndUpdate(
        { id: activity.target, actorId: activity.actorId, deletedAt: null },
        {
          $set: {
            deletedAt: new Date(),
            formerType: "$type",
            type: "Tombstone",
          },
        }
      );
      if (target) activity.objectId = target.id;
      break;

    case "Reply":
      activity.object.actorId = activity.actorId;
      let domain = (await Settings.findOne({ name: "server" })).value;
      let targetDomain = activity.target.split("@").slice(-1);
      if (targetDomain != domain) {
        let url = `https://${targetDomain}/api/inbox`;
        let response = await post(url, activity.actorId, { activity });
        activity.objectId = response.activity.id;
      } else {
        await Post.findOneAndUpdate(
          { id: activity.objectId },
          {
            $set: {
              deletedAt: new Date(),
              formerType: "$type",
              type: "Tombstone",
            },
          }
        );
      }
      break;
  }

  return activity;
}
