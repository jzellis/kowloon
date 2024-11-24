import { Activity } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";

export default async function (activity) {
  try {
    // This passes the activity to the ActivityParser to do whatever the activity is meant to do
    // This normalizes the to, cc and bcc fields for both the activity and its object, if it has one
    if (activity.object) {
      if (typeof (activity.object === "object"))
        activity.object.actorId = activity.object.actorId || activity.actorId;
    }

    // if (!activity.actorId) return { error: "No actor provided" };

    activity = await ActivityParser[activity.type](activity);
    // return activity;
    return await Activity.create(activity);
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
