import { Activity } from "../schema/index.js";

export default async function (activity) {
  return await Activity.create(activity);
}
