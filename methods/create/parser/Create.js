import {
  Post,
  Bookmark,
  Circle,
  Group,
  Outbox,
  User,
} from "../../../schema/index.js";
export default async function (activity) {
  try {
    let actor =
      activity.actor || (await User.findOne({ id: activity.actorId }));

    activity.summary = `${actor.profile.name} (${actor.username}) created ${
      "aeiouAEIOU".indexOf(activity.objectType[0]) !== -1 ? "an" : "a"
    } new ${activity.objectType}`;
    switch (activity.objectType) {
      // If it's a Post

      case "Post":
        activity.object = {
          ...activity.object,
          actorId: activity.object.actorId || activity.actorId,
          to: activity.object.to || activity.to,
          bto: activity.object.bto || activity.bto,
          cc: activity.object.cc || activity.cc,
          bcc: activity.object.bcc || activity.bcc,
        };
        if (activity.object.circles && activity.object.circles.length > 0) {
          activity.public = false;
          activity.object.public = false;
        }

        try {
          let post = await Post.create(activity.object);
          activity.objectId = post.id;
        } catch (e) {
          return new Error(e);
        }
        break;

      // If it's a Circle
      case "Circle":
        activity.object = {
          ...activity.object,
          actorId: activity.object.actorId || activity.actorId,
        };
        try {
          const circle = await Circle.create(activity.object);
          activity.objectId = circle.id;
        } catch (e) {
          return new Error(e);
        }

        break;

      // If it's a Group
      case "Group":
        activity.object = {
          ...activity.object,
          actorId: activity.actorId,
        };
        if (!activity.object.admins || activity.object.admins.length === 0)
          activity.object.admins = [activity.actorId];
        const group = await Group.create(activity.object);
        activity.objectId = group.id;
        break;

      case "Bookmark":
        activity.object.actorId = activity.actorId;
        const bookmark = await Bookmark.create(activity.object);
        activity.objectId = bookmark.id;
        break;

      case "Reply":
        activity.object = {
          ...activity.object,
          actorId: activity.object.actorId || activity.actorId,
          to: activity.object.to || activity.to,
          bto: activity.object.bto || activity.bto,
          cc: activity.object.cc || activity.cc,
          bcc: activity.object.bcc || activity.bcc,
        };

        post = await Post.create(activity.object);
        await Outbox.create({
          actorId: activity.actorId,
          to: activity.target,
          item: activity.object,
        });
        activity.objectId = post.id;
        break;
    }

    return activity;
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
