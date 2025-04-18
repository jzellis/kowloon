// This is the heart of Kowloon -- the activity parser. It generates a new Activity, does whatever an activity of that type is supposed to do, and handles delivery if necessary. It loads its component functions from the 'ActivityParser' folder by name, so if you add a new capitalized file in that folder with an exported function, it will be available as a method for the ActivityParser object -- so, for example, you could create an "Invite" function to handle Activities of type "Invite".

import { Activity, Outbox, User } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";
import validateActivity from "./validateActivity.js";
import getSettings from "./getSettings.js";
import parseId from "./parseId.js";
import { set } from "mongoose";

export default async function (activity) {
  let settings = await getSettings();
  try {
    activity = validateActivity(activity);
    activity.actor = await User.findOne({ id: activity.actorId });
    activity = await ActivityParser[activity.type](activity); // This is the crucial part -- it parses the activity based on its type by calling the method of the ActivityParser object with the same name as the type.
    activity = await Activity.create(activity);

    // Now to deal with delivery if necessary.
    if (activity.target && !activity.target.endsWith(settings.domain)) {
      await Outbox.create({
        to: [activity.target],
        server: parseId(activity.target).server,
        actorId: activity.actorId,
        object: activity.object,
      });
    }

    let externalAddressees = activity.to
      .filter((id) => !id.endsWith(settings.domain))
      .map(async (id) => {
        return {
          to: [id],
          server: parseId(id).server,
          actorId: activity.actorId,
          object: activity.object,
        };
      });
    if (externalAddressees.length > 0) await Outbox.create(externalAddressees);
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
