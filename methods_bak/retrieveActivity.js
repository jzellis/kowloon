import { Activity } from "../schema/index.js";
import get from "./get.js";

export default async function (id) {
  let activity = await Activity.findOne({ id });
  if (!activity) {
    let [aid, domain] = id.split("@");
    let url = `https://${domain}/activities/${aid}`;
    try {
      activity = (await get(url)).activity;
    } catch (e) {
      console.error(e);
    }
  }
  return activity;
}
