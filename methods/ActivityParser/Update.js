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
  let domain = (await Settings.findOne({ name: "domain" })).value;
  if (!activity.object) return new Error("No object provided");
  if (!activity.objectType) return new Error("No object type provided");
  // if (activity.objectType)
  //   activity.object.objectType = activity.object.objectType
  //     ? activity.object.objectType
  //     : activity.objectType;
  try {
    let actor =
      activity.actor || (await User.findOne({ id: activity.actorId }));
    activity.summary = `${actor?.profile?.name} (${actor?.id}) updated ${
      actor.profile.pronouns.possAdj
    } ${indefinite(activity.objectType)}`;

    activity.to = activity.to || [];
    activity.cc = activity.cc || [];
    activity.bcc = activity.bcc || [];
    activity.object.to = activity.object.to || [];
    activity.object.cc = activity.object.cc || [];
    activity.object.bcc = activity.object.bcc || [];

    let recipients = Array.from(
      new Set([
        ...activity.to,
        ...activity.cc,
        ...activity.bcc,
        ...activity.object.to,
        ...activity.object.cc,
        ...activity.object.bcc,
      ])
    );
    let group;
    let groupId = recipients.filter((id) => id.startsWith("group"))[0];
    if (recipients.some((id) => id.startsWith("group"))) {
      group = await Group.findOne({ id: groupId });
    }

    // This is the important part: depending on objectType we do different things.

    switch (activity.objectType) {
      case "Post":
        if (activity.object.title)
          activity.summary += ` "${activity.object.title}"`;
        if (group && group.id) {
          activity.summary += ` in ${group.name}`;
          activity.to = Array.from(new Set([...activity.to, ...group.to]));
          activity.object.to = Array.from(
            new Set([...activity.object.to, ...group.to])
          );
        }
        try {
          let post = await Post.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );

          let feedItem = {
            id: post.id,
            objectType: this.objectType,
            type: post.type,
            url: post.url,
            actor: {
              id: actor.id,
              username: actor.username,
              profile: actor.profile,
              url: actor.url,
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
            to: recipients,
            rto: post.rto,
            retrievedAt: post.createdAt,
          };

          await Feed.findOneAndUpdate(
            { id: post.id },
            { $set: feedItem },
            { upsert: true }
          );
          activity.objectId = post.id;
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;

      case "Circle":
        try {
          let circle = await Circle.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );
          activity.objectId = circle.id;
        } catch (e) {
          return new Error(e);
        }
        break;
      case "Group":
        try {
          let group = await Group.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );
          activity.to.push(group.id);
          activity.objectId = group.id;
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;
      case "Bookmark":
        try {
          let bookmark = await Bookmark.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );

          activity.objectId = bookmark.id;

          if (bookmark.type != "Folder") {
            let feedItem = {
              id: bookmark.id,
              objectType: bookmark.objectType,
              type: bookmark.type,
              url: bookmark.url,
              actor: {
                id: actor.id,
                username: actor.username,
                profile: actor.profile,
              },
              href: bookmark.href,
              actorId: bookmark.actorId,
              title: bookmark.title,
              summary: activity.summary,
              body: bookmark.source.content,
              image: bookmark.image,
              tags: bookmark.tags,
              location: bookmark.location,
              replyCount: bookmark.replyCount,
              reactCount: bookmark.reactCount,
              shareCount: bookmark.shareCount,
              attachments: bookmark.attachments,
              to: bookmark.to,
              cc: bookmark.cc,
              bcc: bookmark.bcc,
              rto: bookmark.rto,
              rcc: bookmark.rcc,
              rbcc: bookmark.rbcc,
              retrievedAt: bookmark.createdAt,
            };

            await Feed.findOneAndUpdate(
              { id: bookmark.id },
              { $set: feedItem },
              { upsert: true }
            );
          }
        } catch (e) {
          console.log(e);
          return new Error(e);
        }
        break;
      case "Reply":
        try {
          let reply = await Reply.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );
          activity.objectId = reply.id;
        } catch (e) {
          return new Error(e);
        }
        break;
      case "File":
        try {
          let file = await File.findOneAndUpdate(
            { id: activity.target },
            { $set: activity.object }
          );
          activity.objectId = file.id;
        } catch (e) {
          return new Error(e);
        }
        break;

      case "User":
        try {
          let user = await User.findOneAndUpdate(
            { id: activity.target },
            { profile: { $set: activity.object.profile } }
          );
          activity.objectId = user.id;
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
