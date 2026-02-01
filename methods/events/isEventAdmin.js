import { Circle, Event } from "#schema";

export default async function isEventAdmin(actorId, eventId) {
  if (!actorId || !eventId) return false;

  const event = await Event.findOne({ id: eventId }).select("admins").lean();
  if (!event?.admins) return false;

  return await Circle.exists({
    id: event.admins,
    "members.id": actorId,
  });
}
