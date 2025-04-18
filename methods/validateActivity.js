import ActivityParser from "./ActivityParser/index.js";

export default function (activity) {
  switch (true) {
    case activity.to.length === 0:
      return new Error("No recipients provided");
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
}
