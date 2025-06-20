// This is the heart of Kowloon -- the activity parser. It generates a new Activity, does whatever an activity of that type is supposed to do, and handles delivery if necessary. It loads its component functions from the 'ActivityParser' folder by name, so if you add a new capitalized file in that folder with an exported function, it will be available as a method for the ActivityParser object -- so, for example, you could create an "Invite" function to handle Activities of type "Invite".

import { Activity, Outbox, User } from "../schema/index.js";
import ActivityParser from "./ActivityParser/index.js";
import getSettings from "./getSettings.js";
import parseId from "./parseId.js";

const validateActivity = function (activity) {
  switch (true) {
    case !activity.to:
      return new Error("No recipients provided");
      break;
    case !activity.replyTo:
      return new Error("No replyTo provided");
      break;
    case !activity.reactTo:
      return new Error("No reactTo provided");
      break;
    case !activity.type:
      return new Error("No activity type provided");
      break;
    case !activity.actorId && !activity.actor:
      return new Error("No actor or actor ID provided");
      break;
    case !ActivityParser[activity.type]:
      return new Error(
        "Invalid activity type. Valid activity types are: " +
          Object.keys(ActivityParser).join(", ")
      );
      break;
    default:
      return activity;
      break;
  }
};

export default async function (activity) {
  let settings = await getSettings();
  try {
    activity = validateActivity(activity);
    if (!ActivityParser[activity.type])
      return new Error(
        `Invalid activity type "${
          activity.type
        }". Valid activity types are: ${Object.keys(ActivityParser).join(", ")}`
      );
    let parsedId = parseId(activity.actorId);
    switch (parsedId.type) {
      case "User":
        activity.actor = await User.findOne({ id: activity.actorId }).select(
          "-_id id profile publicKey"
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
    }
    return activity;
  } catch (e) {
    console.log(e);
    return new Error(e);
  }
}
