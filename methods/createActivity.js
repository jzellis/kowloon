import { Activity } from "../schema/index.js";
import ActivityParser from "./parser/index.js";
import verifyActivity from "./verifyActivity.js";

export default async function (activity) {
  let verified = await verifyActivity(activity);
  if (verified === true) {
    try {
      // This passes the activity to the ActivityParser to do whatever the activity is meant to do
      activity = await ActivityParser[activity.type](activity);
      return await Activity.create(activity);
    } catch (e) {
      console.log(e);
      return { error: e };
    }
  } else {
    return { errors: verified };
  }
}
