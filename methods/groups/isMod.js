import { Group, Circle } from "#schema";

// Returns true if the given actorId is a member of the Group's admins circle
export default async function isGroupAdmin(actorId, groupId) {
  if (!actorId || !groupId) return false;

  const gr = await Group.findOne({ id: groupId }).select("moderators").lean();
  if (!gr || !gr.moderators) return false;

  return !!(await Circle.exists({ id: gr.admins, "members.id": actorId }));
}
