import { Activity, User, Inbox } from "../schema/index.js";
import parseId from "./parseId.js";

export default async function (item) {
  let response;
  let actor = await User.findOne({ id: item.to });
  if (!actor) return new Error("User not found on this server");
  let activity = await Activity.findOneAndUpdate(
    { id: item.activity.id },
    item.activity,
    {
      upsert: true,
      new: true,
    }
  );
  return response;
}
