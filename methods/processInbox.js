import { Inbox } from "../schema/index.js";
import InboxParser from "./InboxParser/index.js";
export default async function (limit = 0, skip = 0) {
  let queue = await Inbox.find({ status: "pending" }).limit(limit).skip(skip);
  await Promise.all(
    queue.map(async (item) => {
      if (InboxParser[item.activity.type]) {
        // This is where we need to check to see if the activity's "to" or "target" User or Group or whatever has the sender blocked, but I haven't figured that out yet.
        let result = await InboxParser[item.activity.type](item.activity);
        item.status = "completed";
        await item.save();
      } else {
        return new Error("Invalid activity type");
      }
    })
  );
  return true;
}
