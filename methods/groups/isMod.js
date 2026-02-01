import { Circle, Group } from "#schema";

export default async function isGroupMod(actorId, groupId) {
  if (!actorId || !groupId) return false;

  const group = await Group.findOne({ id: groupId }).select("circles.moderators").lean();
  if (!group?.circles?.moderators) return false;

  return await Circle.exists({
    id: group.circles.moderators,
    "members.id": actorId,
  });
}
