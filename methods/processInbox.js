import { Circle, Inbox } from "../schema/index.js";
import InboxParser from "./InboxParser/index.js";
import getObjectById from "./getObjectById.js";
export default async function (limit = 0, skip = 0) {
  let queue = await Inbox.find({ status: "pending" }).limit(limit).skip(skip);
  await Promise.all(
    queue.map(async (item) => {
      if (InboxParser[item.activity.type]) {
        // This is where we need to check to see if the activity's "to" or "target" User or Group or whatever has the sender blocked. This gets the "to" and "target" items and, if they exist and have "blocked" fields and the item's activity.actorId is in either of them, it just doesn't process the incoming item at all and marks it as "blocked".
        let to = await getObjectById(item.activity.to);
        let target = await getObjectById(item.activity.target);
        let actor = await getObjectById(target?.actorId);

        if (
          (
            await Circle.find({
              id: {
                $in: [to?.blocked, target?.blocked, actor?.blocked],
              },
            })
          )
            .flatMap((m) => m.members.map((i) => i.id))
            .includes(item.activity.actorId)
        ) {
          item.status = "blocked";
        } else {
          await InboxParser[item.activity.type](item.activity);
          item.status = "completed";
        }
        await item.save();
      } else {
        return new Error("Invalid activity type");
      }
    })
  );
  return true;
}
