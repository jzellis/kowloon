import { Group } from "../../schema/index.js";

export default async function (activity) {
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });
  activity.summary = `@${user.profile.name} joined ${group.name}`;
  switch (activity.objectType) {
    case "Group":
      let group = await Group.findOne({ id: activity.target });
      let where = group.approval
        ? { pending: activity.object }
        : { members: activity.object };
      await Group.findOneAndUpdate({ id: activity.target }, { $push: where });
      break;
  }
  return activity;
}
