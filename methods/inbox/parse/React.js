import { React } from "#schema";

import getObjectById from "#utils/getObjectById.js";
export default async function (activity) {
  let item = await getObjectById(activity.target);
  if (item) {
    let react = await React.findOneAndUpdate(
      { id: activity.object.id },
      { $set: activity.object }, //activity.object,
      { new: true, upsert: true }
    );
    activity.objectId = react.id;
    activity.object = react;
    if (react?.lastErrorObject?.upserted) item.reactCount++; // If the react isn't already in the db, increment the original object's reactCount
    await item.save();
  }
  return activity;
}
