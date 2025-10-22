import ActivityParser from "./parse/index.js";

export default function (activity) {
  switch (true) {
    case !activity.to:
      throw new Error("No recipients provided");
      break;
    // case !activity.canReply:
    //   throw new Error("No canReply provided");
    //   break;
    // case !activity.canReact:
    //   throw new Error("No canReact provided");
    //   break;
    case !activity.type:
      throw new Error("No activity type provided");
      break;
    case !activity.actorId && !activity.actor:
      throw new Error("No actor or actor ID provided");
      break;
    case !ActivityParser[activity.type]:
      throw new Error(
        "Invalid activity type. Valid activity types are: " +
          Object.keys(ActivityParser).join(", ")
      );
      break;
    default:
      return activity;
      break;
  }
}
