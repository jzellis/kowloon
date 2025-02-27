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
    if (!activity.to && activity.object.to) activity.to = activity.object.to;
    if (!activity.cc && activity.object.cc) activity.cc = activity.object.cc;
    if (!activity.bcc && activity.object.bcc)
      activity.bcc = activity.object.bcc;
    if (!activity.rto && activity.object.rto)
      activity.rto = activity.object.rto;
    if (!activity.rcc && activity.object.cc) activity.rcc = activity.object.rcc;
    if (!activity.rbcc && activity.object.rbcc)
      activity.bcc = activity.object.rbcc;

    // if (!activity.actorId) return { error: "No actor provided" };

    if (!ActivityParser[activity.type])
      return {
        error:
          "Invalid activity type. Valid activity types are: " +
          Object.keys(ActivityParser).join(", "),
      };

    activity = await ActivityParser[activity.type](activity);
    // return activity;
    return await Activity.create(activity);
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
