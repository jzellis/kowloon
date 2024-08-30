import { Activity } from "../../schema/index.js";
import get from "../remote/get.js";

export default async function (id) {
  let activity = await Activity.findOne({ id });
  if (!activity) {
    let [aid, domain] = id.split("@");
    let url = `https://${domain}/activities/${aid}`;
    console.log("retrieving acitivity from", url);
    try {
      activity = (await get(url)).activity;
    } catch (e) {
      console.error(e);
    }
  }
  return activity;
}
