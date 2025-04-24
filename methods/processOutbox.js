import { Outbox } from "../schema/index.js";
import post from "./post.js";
import parseId from "./parseId.js";

export default async function (limit = 0, skip = 0) {
  let queue = await Outbox.find({ status: "pending" }).limit(limit).skip(skip);

  await Promise.all(
    queue.map(async (item) => {
      item.lastAttemptedAt = new Date();
      try {
        let response = await post(
          `https://${parseId(item.activity.to).server}/inbox`,
          { activity: item.activity }
        );
        if (response) {
          item.response = response;
          item.status = "delivered";
          item.deliveredAt = new Date();
        } else {
          item.status = "error";
        }
      } catch (e) {
        console.log(e);
        item.error = e;
        item.status = "error";
      }
      await item.save();
    })
  );
}
