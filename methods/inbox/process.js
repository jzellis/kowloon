import { Circle, Inbox } from "#schema";
import ActivityParser from "#ActivityParser";
import getObjectById from "#methods/get/objectById.js";
export default async function (limit = 0, skip = 0) {
  const parser = await ActivityParser();
  let queue = await Inbox.find({ status: "pending" }).limit(limit).skip(skip);
  await Promise.all(
    queue.map(async (item) => {
      if (parser[item.activity.type]) {
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
          await parser[item.activity.type](item.activity);
          item.status = "completed";
        }
        await item.save();
      } else {
        throw new Error("Invalid activity type");
      }
    })
  );
  return true;
}
