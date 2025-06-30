import {
  Post,
  Page,
  Bookmark,
  Circle,
  Event,
  Group,
  File,
  User,
} from "../../schema/index.js";
import indefinite from "indefinite";
export default async function (activity) {
  if (!activity.object) return new Error("No object provided");
  if (!activity.objectType) return new Error("No object type provided");
  activity.summary = `${activity.actor?.profile?.name} (${
    activity.actor?.id
  }) created ${indefinite(activity.objectType)}`;

  let group;
  if (activity.to.startsWith("group"))
    group = await Group.findOne({ id: activity.to }).select(
      "-flaggedAt -flaggedBy -flaggedReason -approval  -deletedAt -deletedBy -_id -__v -members -admins -pending -banned"
    );

  if (activity.objectType != "User") {
    activity.object.actor = activity.actor;
    activity.object.actorId = activity.actorId;
  }
  switch (activity.objectType) {
    //Create a Post
    case "Post":
      activity.summary = `${activity.actor?.profile?.name} (${
        activity.actor?.id
      }) created ${indefinite(activity.object.type)}${
        activity.object.title ? ': "' + activity.object.title + '"' : ""
      }`;
      if (group?.name) {
        activity.summary = `${activity.actor?.profile?.name} (${
          activity.actorId
        }) posted ${indefinite(activity.object.type)} in ${group.name}`;
      }
      if (group) activity.object.group = group;
      try {
        let post = await Post.create(activity.object);
        activity.object = post;
        activity.objectId = post.id;
      } catch (e) {
        activity.error = new Error(e);
      }
      break;

    //Create a Circle
    case "Circle":
      activity.summary = `${activity.actor.profile.name} (${
        activity.actor.id
      }) created ${indefinite(activity.objectType)}: ${activity.object.name}`;
      try {
        let circle = await Circle.create(activity.object);
        activity.objectId = circle.id;
        activity.object = circle;
      } catch (e) {
        console.log(e);
        activity.error = new Error(e);
      }
      break;

    // Create a Group
    case "Group":
      activity.summary = `${activity.actor?.profile.name} (${
        activity.actor?.id
      }) created ${indefinite(activity.objectType)}: ${activity.object.name}`;
      try {
        let group = await Group.create(activity.object);
        activity.objectId = group.id;
        activity.object = group;
      } catch (e) {
        console.log(e);
        activity.error = new Error(e);
      }
      break;

    case "Bookmark":
      activity.summary = `${activity.actor.profile.name} (${activity.actor.id}) bookmarked "${activity.object.title}"`;
      if (activity.object.parent) {
        let parent = await Bookmark.findOne({ id: activity.object.parent });
        if (parent) activity += ` in ${parent.title}`;
      }
      try {
        let bookmark = await Bookmark.create(activity.object);
        activity.objectId = bookmark.id;
        activity.object = bookmark;
      } catch (e) {
        console.log(e);
        activity.error = new Error(e);
      }
      break;

    case "Event":
      try {
        let event = await Event.create(activity.object);
        activity.objectId = event.id;
      } catch (e) {
        activity.error = new Error(e);
      }
      break;

    case "Page":
      try {
        let user = await User.findOne({ id: activity.actorId }).lean();
        if (user.isAdmin) {
          let page = await Page.create(activity.object);
          activity.objectId = page.id;
        } else {
          activity.error = new Error("Only admins can create pages");
        }
      } catch (e) {
        activity.error = new Error(e);
      }
      break;

    case "File":
      try {
        let file = await File.create(activity.object);
        activity.objectId = file.id;
      } catch (e) {
        activity.error = new Error(e);
      }
      break;

    case "User":
      try {
        activity.object.username = activity.object.username
          .toLowerCase()
          .trim();
        activity.object.email = activity.object.email.toLowerCase().trim();
        let actor = await User.create(activity.object);
        activity.objectId = actor.id;
        // activity.actorId = settings.actorId;
        activity.object = actor;
        activity.object.password = undefined;
        activity.summary = `${actor.profile.name} (${actor.id}) joined the server`;
      } catch (e) {
        activity.error = new Error(e);
      }
      break;
  }

  return activity;
}
