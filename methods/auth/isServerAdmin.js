import { Settings, Circle } from "#schema";

export default async function isServerAdmin(actorId) {
  if (!actorId) return false;
  // Read directly from DB — never use the in-memory settings cache here.
  // After a restore the cache is stale; this ensures the check is always authoritative.
  const setting = await Settings.findOne({ name: "adminCircle" }).lean();
  const adminCircleId = setting?.value;
  if (!adminCircleId) return false;
  return await Circle.exists({ id: adminCircleId, "members.id": actorId });
}
