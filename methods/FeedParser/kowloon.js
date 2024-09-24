import get from "../get.js";
import { Feed } from "../../schema/index.js";

export default async function (url, actorId) {
  if (!url.endsWith("/posts")) url += "/posts";
  let feed = await get(url, actorId);
  try {
    await Promise.all(
      feed.map(async (item) => {
        console.log(item);
        await Feed.findOneAndUpdate(
          { id: item.id },
          {
            $set: {
              id: item.id,
              $addToSet: {
                to: { $each: item.to },
                bto: { $each: item.bto },
                cc: { $each: item.cc },
                bcc: { $each: item.bcc },
              },
              item: item,
            },
          },
          { upsert: true }
        );
      })
    );
  } catch (e) {
    return new Error(e);
  }
}
