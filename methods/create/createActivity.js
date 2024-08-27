import { Activity } from "../../schema/index.js";
import ActivityParser from "./parser/index.js";

export default async function (activity) {
  try {
    activity = await ActivityParser[activity.type](activity);
    return await Activity.create(activity);
  } catch (e) {
    return { error: e };
  }
}
