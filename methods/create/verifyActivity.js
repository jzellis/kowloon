import { User } from "../../schema/index.js";

export default async function (activity) {
  // These activities require a target to be specified
  let targetedActivities = [
    "Add",
    "Approve",
    "Block",
    "Delete",
    "Join",
    "Leave",
    "Mute",
    "Remove",
    "Update",
  ];
  let errors = [];
  // These activities require an object to be specified
  let objectedActivities = ["Add", "Approve", "Create", "Reject", "Update"];
  // These activities require an objectType to be specified
  let objectTypedActivities = ["Create"];
  // These activities require the user to be local to the server
  let localActivities = [
    "Add",
    "Approve",
    "Block",
    "Delete",
    "Update",
    "Join",
    "Leave",
    "Mute",
    "Reject",
    "Remove",
    "Unblock",
    "Unmute",
  ];
  if (!activity) errors.push("No activity");
  if (!activity.type) errors.push("No activity type specified");
  if (!activity.actorId) errors.push("No actor specified");
  if (targetedActivities.indexOf(activity.type) != -1 && !activity.target)
    errors.push(`Activity type "${activity.type}" requires a target`);
  if (objectedActivities.indexOf(activity.type) != -1 && !activity.object)
    errors.push(`Activity type "${activity.type}" requires an object`);
  if (localActivities.indexOf(activity.type) != -1) {
    let localUser = await User.findOne({ id: activity.actorId });
    if (!localUser)
      errors.push(
        `This activity requires the user to be a member of this server`
      );
  }

  if (objectTypedActivities.indexOf(activity.type) != -1 && !activity.object)
    errors.push(
      `Activity type "${activity.type}" requires an objectType to be specified`
    );

  if (errors.length > 0) console.log(errors);
  return errors.length > 0 ? errors : true;
}
