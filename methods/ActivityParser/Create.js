import {
  Post,
  Bookmark,
  Circle,
  Group,
  File,
  User,
  Reply,
  Settings,
} from "../../schema/index.js";
import indefinite from "indefinite";
export default async function (activity) {
  let domain = (await Settings.findOne({ name: "domain" })).value;
  if (!activity.object) return new Error("No object provided");
  if (!activity.objectType) return new Error("No object type provided");
  try {
    let actor =
      activity.actor || (await User.findOne({ id: activity.actorId }));
    activity.summary = `${actor?.profile?.name} (${
      actor?.id
    }) created ${indefinite(activity.objectType)}`;

    // This is the important part: depending on objectType we do different things.

    switch (activity.objectType) {
      case "Post":
        activity.summary = `${actor.profile.name} (${
          actor.id
        }) created ${indefinite(activity.object.type)}`;

        try {
          await Promise.all(
            activity.object.to.map(async (addr) => {
              if (addr.startsWith("group")) {
                let group = await Group.findOne({ id: addr });
                activity.summary = `${actor.profile.name} (${
                  actor.id
                }) posted ${indefinite(activity.objectType)} in ${group.name}`;
                activity.to = activity.to.concat(group.to);
                activity.object.to = [...activity.object.to, ...group.to];
              }
            })
          );

          activity.object.to = Array.from(new Set(activity.object.to));
          let post = await Post.create(activity.object);
          activity.objectId = post.id;
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;
      case "Reply":
        try {
          let post = await Post.findOne({ id: activity.target });
          activity.object.target = activity.object.target || post.id;
          activity.object.cc = [post.actorId];
          activity.cc = [post.actorId];
          activity.summary = `${actor.profile.name} (${actor.id}) replied to a post`;
          let reply = await Reply.create(activity.object);
          activity.objectId = reply.id;
          post.replyCount++;
          await post.save();
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;

      case "Circle":
        try {
          let circle = await Circle.create(activity.object);
          activity.objectId = circle.id;
        } catch (e) {
          return new Error(e);
        }
        break;
      case "Group":
        try {
          let group = await Group.create(activity.object);
          group.admins.push(activity.actorId);
          await group.save();
          activity.to.push(group.id);
          activity.objectId = group.id;
        } catch (e) {
          return new Error(e);
        }
        break;
      case "Bookmark":
        try {
          let post = await Post.findOne({ id: activity.object.target });
          let bookmark = await Bookmark.create(activity.object);
          activity.objectId = bookmark.id;
          activity.summary = `${actor.profile.name} (${
            actor.id
          }) bookmarked ${indefinite(post.type)}`;
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;
      case "Reply":
        try {
          let post = await Post.findOne({ id: activity.object.target });

          let reply = await Reply.create(activity.object);
          activity.summary = `${actor.profile.name} (${
            actor.id
          }) replied to ${indefinite(post.type)}`;
          activity.objectId = reply.id;
        } catch (e) {
          return new Error(e);
        }
        break;
      case "File":
        try {
          let file = await File.create(activity.object);
          activity.objectId = file.id;
        } catch (e) {
          return new Error(e);
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
          activity.actorId = actor.id;
          activity.object = actor;
          activity.object.password = undefined;
          activity.object.keys.private = undefined;
          activity.object.accessToken = undefined;
          activity.summary = `${actor.profile.name} (${actor.id}) joined the server`;
          activity.to = activity.object.to;
          activity.cc = activity.object.cc;
          activity.bcc = activity.object.bcc;
          activity.rbcc = activity.object.rbcc;
          activity.rto = activity.object.rto;
          activity.rcc = activity.object.rcc;
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;
    }
    return activity;
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
