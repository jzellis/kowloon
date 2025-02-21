import { User, Feed, Circle } from "../schema/index.js";
import createUserSignature from "./createUserSignature.js";
import createServerSignature from "./createServerSignature.js";
export default async function (actorId, circleId) {
  try {
    const headers = {
      "Content-Type": "application/json",
      Accepts: "application/json",
      "Kowloon-Id": actorId,
      "Kowloon-Timestamp": Date.now(),
      "Kowloon-Signature": await createUserSignature(actorId, timestamp),
    };
    let serverCreds = await createServerSignature();
    headers["kowloon-server-id"] = serverCreds.id;
    headers["kowloon-server-timestamp"] = serverCreds.timestamp;
    headers["kowloon-server-signature"] = serverCreds.signature;

    let feeds = [],
      items = [];
    if (circleId) {
      let circle = await Circle.findOne({ id: circleId }).select("members");
      feeds.concat(circle.members);
    } else {
      let circles = await Circle.find({ actorId }).select("members");
      circles.forEach((c) => {
        feeds.concat(c.members);
      });
    }

    feeds = Array.from(new Set(feeds));

    await Promise.all(
      feeds.forEach(async (f) => {
        let url = f.outbox;

        let request = await fetch(url, { headers });
        if (request.ok) response = await request.json();
        items.concat(response.items);
      })
    );

    await Promise.all(
      items.forEach(async (i) => {
        i.to.push(actorId);
        await Feed.findOneAndUpdate({ i: id }, { $set: i }, { upsert: true });
      })
    );
    return items;
  } catch (e) {
    return new Error(e);
  }
}
