import { Event, Circle } from "#schema";

// Returns true if the given actorId is a member of the Event's admins circle
export default async function isEventAdmin(actorId, eventId) {
  if (!actorId || !eventId) return false;

  const ev = await Event.findOne({ id: eventId }).select("admins").lean();
  if (!ev || !ev.admins) return false;

  return !!(await Circle.exists({ id: ev.admins, "members.id": actorId }));
}
