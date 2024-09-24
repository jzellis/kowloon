import { Activity } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";

export default async function (activity) {
  try {
    // This passes the activity to the ActivityParser to do whatever the activity is meant to do
    activity = await ActivityParser[activity.type](activity);
    return await Activity.create(activity);
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
