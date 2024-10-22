import get from "../get.js";
import { Feed } from "../../schema/index.js";

export default async function (url, actorId) {
  if (!url.endsWith("/posts")) url += "/posts";
  let feed = await get(url, actorId);
  try {
    await Promise.all(
      feed.map(async (item) => {
        let object = item.object;
        await Feed.findOneAndUpdate(
          { id: item.id },
          {
            $addToSet: {
              to: { $each: item.to },
              bto: { $each: item.bto },
              cc: { $each: item.cc },
              bcc: { $each: item.bcc },
            },
            $set: {
              id: item.id,
              type: object.type,
              object,
              // item: {
              //   id: object.id,
              //   type: object.type,
              //   title: object.title || null,
              //   content_text: object.summary || null,
              //   content_html: object.source.content || null,
              //   url: object.url,
              //   external_url: item.href,
              //   image: item.featuredImage,
              //   date_published: object.createdAt,
              //   date_modified: object.updatedAt,
              //   author: object.actorId,
              //   tags: object.tags || null,
              // },
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
