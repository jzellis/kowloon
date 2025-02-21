import { User, Circle } from "../../schema/index.js";
import parseId from "../parseId.js";
import createServerSignature from "../createServerSignature.js";
import Parser from "rss-parser";
export default async function (activity) {
  let actor = await User.findOne({ id: activity.actorId });
  let circle = activity.target
    ? await Circle.findOne({ id: activity.target })
    : await Circle.findOne({ id: actor.following });
  let targetUser, memberRec;
  targetUser = await User.findOne({ id: activity.object });
  if (targetUser) {
    memberRec = {
      id: targetUser.id,
      type: "kowloon",
      name: targetUser.profile.name,
      icon: targetUser.profile.icon,
      inbox: targetUser.inbox,
      outbox: targetUser.outbox,
      updatedAt: Date.now(),
    };
  } else {
    let parsed = parseId(activity.object);
    let url;
    let { id, timestamp, signature } = await createServerSignature();

    if (parsed.type === "rss") {
      let parser = new Parser();
      let feed = await parser.parseUrl(activity.object);
      memberRec = {
        id: activity.target,
        type: "rss",
        name: feed.title,
        icom: feed.image.url,
        inbox: null,
        outbox: activity.target,
        updatedAt: Date.now(),
      };
      // Do rss stuff
    } else {
      let url =
        type == "user"
          ? `https://${parsed.server}/users/${parsed.id}`
          : `https://${parsed.server}/`;
      let response;
      let request = await fetch(url, {
        "Content-Type": "application/json",
        Accepts: "application/json",
        "Kowloon-id": id,
        "Kowloon-timestamp": timestamp,
        "Kowloon-signature": signature,
      });
      if (request.ok) response = await request.json();
      memberRec = {
        id: response.id,
        type: "kowloon",
        name: response.profile.name,
        icon: response.profile.icon,
        inbox: response.inbox,
        outbox: response.outbox,
        updatedAt: Date.now(),
      };
    }
    // Find user in universe
  }

  circle.members.push(memberRec);
  await circle.save();
  activity.summary = `${actor.profile.name} (${actor.id}) followed ${memberRec.name}`;
  return activity;
}

// let newFollowId;
// let userFollowingCircle = await Circle.findOne({ id: user.following });
// // let isLocalFeed = await isLocal(activity.target);
// let newFeed = {};
// let feedItems = [];
// let feed = await Feed.findOne({
//   $or: [{ id: activity.target }, { href: activity.target }],
// });

// if (feed) {
//   newFollowId = feed.id;
// } else {
//   let remoteFeed = await fetch(activity.target, {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//       mode: "no-cors",
//       Accept: "application/json",
//       "kowloon-id": user.id,
//       Authorization: `Basic ${user.publicKey.replaceAll("\n", "\\r\\n")}`,
//     },
//   });

//   let contentType = remoteFeed.headers.get("Content-Type");
//   console.log(contentType);
//   switch (true) {
//     case contentType.includes("xml"):
//       console.log("is RSS");
//       let parser = new Parser();
//       feed = await parser.parseURL(activity.target);
//       newFeed = await Feed.create({
//         type: "rss",
//         title: feed.title,
//         href: feed.link,
//         summary: feed.description,
//         icon: feed.image.url,
//       });

//       feedItems = feed.items.map((item) => {
//         console.log(item);
//         return {
//           feedId: newFeed.id,
//           object: {
//             actor: {
//               id: newFeed.id,
//               profile: {
//                 name: feed.title,
//                 icon: feed.image.url,
//                 bio: feed.description,
//                 urls: [activity.target],
//               },
//             },
//             type: "Article",
//             title: item.title,
//             to: ["@public"],
//             summary: item.contentSnippet,
//             href: item.link,
//             createdAt: item.pubDate,
//             source: {
//               content: item.content,
//               mediaType: "text/html",
//             },
//           },
//         };
//       });
//       await Feed.insertMany(feedItems);
//       break;
//     case contentType.includes("kowloon"):
//       feed = await remoteFeed.json();
//       newFeed = await Feed.create({
//         title: feed.title,
//         href: activity.target,
//         summary: feed.actor.profile.bio,
//         icon: feed.actor.profile.icon,
//       });
//       feedItems = feed.items.map((item) => {
//         return {
//           feedId: newFeed.id,
//           object: { ...item, actor: feed.actor },
//         };
//       });
//       await Feed.insertMany(feedItems);

//       break;
//   }
// }
// activity.objectId = (await Feed.create(newFeed)).id;
// userFollowingCircle.members.push(newFollowId);
// await userFollowingCircle.save();
