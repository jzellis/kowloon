import { Circle, Group } from "#schema";

export default async function isGroupAdmin(actorId, groupId) {
  if (!actorId || !groupId) return false;

  const group = await Group.findOne({ id: groupId }).select("circles.admins").lean();
  if (!group?.circles?.admins) return false;

  return await Circle.exists({
    id: group.circles.admins,
    "members.id": actorId,
  });
}
