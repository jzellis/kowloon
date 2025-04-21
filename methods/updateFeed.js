import { User, Feed, Circle } from "../schema/index.js";
import getSettings from "./getSettings.js";
import Parser from "rss-parser";
import { getLinkPreview } from "link-preview-js";
import createUserSignature from "./createUserSignature.js";
import createServerSignature from "./createServerSignature.js";
export default async function (actorId, circleId) {
  try {
    let settings = await getSettings();
    let serverCreds = await createServerSignature();
    const headers = {
      "Content-Type": "application/json",
      Accepts: "application/json",
      "Kowloon-Id": actorId,
      "Kowloon-Timestamp": Date.now(),
      "Kowloon-Signature": await createUserSignature(actorId, Date.now()),
      "Kowloon-Server-Id": serverCreds.id,
      "Kowloon-Server-Timestamp": serverCreds.timestamp,
      "Kowloon-Server-Signature": serverCreds.signature,
    };

    let feeds = [],
      items = await Feed.find({
        $or: [{ to: actorId }, { cc: actorId }, { bcc: actorId }],
      });
    if (circleId) {
      let circle = await Circle.findOne({ id: circleId }).select("members");
      feeds.concat(circle.members);
    } else {
      let circles = await Circle.find({ actorId }).select("members");
      circles.forEach((c) => {
        feeds.push(...c.members);
      });
    }

    feeds = Array.from(new Set(feeds));

    let parser = new Parser();

    await Promise.all(
      feeds.map(async (f) => {
        if (f.serverId != `@${settings.domain}`) {
          // If this is a remote user, not a local one, whose Feed items are already added
          let url = f.outbox;

          if (f.type != "rss") {
            // If this isn't an RSS feed
            try {
              let response,
                request = await fetch(url, { headers });
              if (request.ok) {
                response = await request.json();
                if (response.items) items.concat(response.items);
              }
            } catch (e) {
              console.log(e);
            }
            return true;
          } else {
            // If it is an RSS feed
            let rss = await parser.parseURL(url);
            let parsedUrl = new URL(url);

            items.concat(
              await Promise.all(
                rss.items.map(async (i) => {
                  let preview = await getLinkPreview(i.link);

                  return {
                    id: `post:${i.link}`,
                    actorId: f.id,
                    type: "Link",
                    href: i.link,
                    to: [actorId],
                    title: i.title,
                    createdAt: i.pubDate,
                    body: i.content,
                    image: preview.images[0] || undefined,
                    actor: {
                      id: f.id,
                      profile: {
                        name: rss.title,
                        icon: rss.image.link,
                        description: rss.description,
                      },
                    },
                  };
                  return true;
                })
              )
            );
          }
        }
      })
    );

    // await Promise.all(
    //   items.forEach(async (i) => {
    //     i.to.push(actorId);
    //     await Feed.findOneAndUpdate(
    //       { i: id },
    //       { $set: i, to: { $push: i.to } },
    //       { upsert: true }
    //     );
    //   })
    // );
    return items;
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
