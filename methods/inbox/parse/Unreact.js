import { React } from "#schema";
import getObjectById from "#utils/getObjectById.js";

export default async function (activity) {
  let item = await getObjectById(activity.target);
  if (item) {
    let react = await React.findOneAndUpdate(
      { target: activity.target, actorId: activity.actorId },
      { $set: { deletedAt: new Date() } }
    );
    activity.objectId = react.id;
    activity.object = react;
    if (react?.lastErrorObject?.upserted) item.reactCount--;
    await item.save();
  }
  return activity;
}
