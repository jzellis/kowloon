// This is the heart of Kowloon -- the activity parser. It generates a new Activity, does whatever an activity of that type is supposed to do, and handles delivery if necessary. It loads its component functions from the 'ActivityParser' folder by name, so if you add a new capitalized file in that folder with an exported function, it will be available as a method for the ActivityParser object -- so, for example, you could create an "Invite" function to handle Activities of type "Invite".

import { Activity, Outbox, User } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";
import getSettings from "./getSettings.js";
import parseId from "./parseId.js";
import validateActivity from "./validateActivity.js";

export default async function (activity) {
  const settings = await getSettings();
  try {
    activity = validateActivity(activity);
    if (!ActivityParser[activity.type])
      throw new Error(
        `Invalid activity type "${
          activity.type
        }". Valid activity types are: ${Object.keys(ActivityParser).join(", ")}`
      );
    let parsedId = parseId(activity.actorId);
    switch (parsedId.type) {
      case "User":
        activity.actor = await User.findOne({ id: activity.actorId }).select(
          "-_id id profile publicKey type url inbox outbox"
        );
        break;
      case "Server":
        activity.actor = {
          id: settings.actorId,
          profile: settings.profile,
          publicKey: settings.publicKey,
        };
        break;
    }
    activity = await ActivityParser[activity.type](activity); // This is the crucial part -- it parses the activity based on its type by calling the method of the ActivityParser object with the same name as the type.

    if (activity.object && typeof activity.object === "object") {
      activity.object.actor = activity.object.actor || activity.actor;
      activity.object.actorId = activity.object.actorId || activity.actorId;
    }

    if (!activity.error) {
      activity = await Activity.create(activity);

      // Now to deal with delivery if necessary.
      await Outbox.findOneAndUpdate(
        { "activity.id": activity.id },
        {
          activity: activity,
        },
        { new: true, upsert: true }
      );
    } else {
      console.log("Error: " + activity.error);
    }

    return activity;
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
}
