import {
  Post,
  Bookmark,
  Circle,
  Group,
  File,
  Feed,
  User,
  Reply,
  Settings,
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

      try {
        let post = await Post.create(activity.object);
        activity.objectId = post.id;

        await Feed.create({
          id: post.id,
          objectType: this.objectType,
          type: post.type,
          url: post.url,
          actor: {
            id: activity.actor.id,
            username: activity.actor.username,
            profile: activity.actor.profile,
            url: activity.actor.url,
          },
          group: group
            ? {
                id: group.id,
                name: group.name,
                icon: group.icon,
                summary: group.summary,
                url: group.url,
              }
            : undefined,
          href: post.href,
          actorId: post.actorId,
          title: post.title,
          summary: post.summary,
          body: post.body,
          image: post.image,
          tags: post.tags,
          location: post.location,
          replyCount: post.replyCount,
          reactCount: post.reactCount,
          shareCount: post.shareCount,
          attachments: post.attachments,
          to: post.to,
          replyTo: post.replyTo,
          reactTo: post.reactTo,
          retrievedAt: post.createdAt,
        });
      } catch (e) {
        activity.error = e;
      }
      break;

    //Create a Circle
    case "Circle":
      activity.summary = `${actor.profile.name} (${
        actor.id
      }) created ${indefinite(activity.object.type)}: ${activity.object.name}`;
      try {
        let circle = await Circle.create(activity.object);
        activity.objectId = circle.id;
      } catch (e) {
        activity.error = e;
      }
      break;

    // Create a Group
    case "Group":
      activity.summary = `${actor.profile.name} (${
        actor.id
      }) created ${indefinite(activity.object.type)}: ${activity.object.name}`;
      try {
        let group = await Group.create(activity.object);
        activity.to.push(group.id);
        activity.objectId = group.id;
      } catch (e) {
        console.log(e);
        activity.error = e;
      }
      break;

    case "Bookmark":
      activity.summary = `${actor.profile.name} (${actor.id}) bookmarked "${activity.object.title}"`;
      if (bookmark.parent) {
        let parent = await Bookmark.findOne({ id: bookmark.parent });
        if (parent) activity += ` in ${parent.title}`;
      }
      try {
        let bookmark = await Bookmark.create(activity.object);
        activity.objectId = bookmark.id;
      } catch (e) {
        activity.error = e;
      }
      break;

    case "File":
      try {
        let file = await File.create(activity.object);
        activity.objectId = file.id;
      } catch (e) {
        activity.error = e;
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
        activity.actorId = settings.actorId;
        activity.object = actor;
        activity.object.password = undefined;
        activity.summary = `${actor.profile.name} (${actor.id}) joined the server`;
      } catch (e) {
        activity.error = e;
      }
      break;
  }

  return activity;
}
