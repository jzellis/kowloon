// #ActivityParser/handlers/Join/index.js
import { Event, Group, Circle, User } from "#schema";

export default async function Join(activity, ctx = {}) {
  const actorId = activity.actorId;
  const targetId =
    activity.target ||
    (typeof activity.object === "string"
      ? activity.object
      : activity.object?.id);

  if (!actorId || !targetId) {
    return { activity, error: "Join: missing actorId or target id" };
  }

  // Resolve target: Event or Group
  let target = await Event.findOne({ id: targetId }).lean();
  let kind = "Event";
  if (!target) {
    target = await Group.findOne({ id: targetId }).lean();
    kind = target ? "Group" : null;
  }
  if (!target) return { activity, error: "Join: target not found" };

  // Blocked check
  if (target.blocked) {
    const isBlocked = await Circle.exists({
      id: target.blocked,
      "members.id": actorId,
    });
    if (isBlocked)
      return {
        activity,
        error: `Join: user is blocked from this ${kind.toLowerCase()}`,
      };
  }

  // Capacity check (events only)
  if (
    kind === "Event" &&
    target.capacity &&
    target.capacity > 0 &&
    target.attendingCount >= target.capacity
  ) {
    return { activity, error: "Join: event is at capacity" };
  }

  // Policy
  const policy = (target.rsvpPolicy) || "invite_only";

  if (policy === "invite_only") {
    const invitedCircle = target.invited;
    if (!invitedCircle) {
      return {
        activity,
        error: `Join: invite required (${kind.toLowerCase()} is invite_only)`,
      };
    }
    const invited = await Circle.exists({
      id: invitedCircle,
      "members.id": actorId,
    });
    if (!invited) {
      return {
        activity,
        error: `Join: invite required (${kind.toLowerCase()} is invite_only)`,
      };
    }
  } else if (policy === "approval") {
    // enqueue request/pending
    const pendingCircle =
      kind === "Event" ? target.interested : target.requests;
    if (pendingCircle) {
      await Circle.updateOne(
        { id: pendingCircle, "members.id": { $ne: actorId } },
        { $push: { members: { id: actorId } }, $inc: { memberCount: 1 } }
      );
      if (kind === "Event") {
        await Event.updateOne(
          { id: target.id },
          { $inc: { interestedCount: 1 } }
        );
      }
      return { activity, result: { type: kind, status: "pending" } };
    }
    return {
      activity,
      error: `Join: approval pending queue not configured for this ${kind.toLowerCase()}`,
    };
  } else if (policy !== "open") {
    return { activity, error: `Join: unsupported policy "${policy}"` };
  }
  // Proceed for open and invite_only

  // Build member object (light enrichment if local user exists)
  const u = await User.findOne({ id: actorId }).lean();
  const member = u
    ? {
        id: u.id,
        name: u?.profile?.name,
        icon: u?.profile?.icon,
        url: u?.url,
        inbox: u?.inbox,
        outbox: u?.outbox,
        server: u?.server,
      }
    : { id: actorId };

  const destCircle = kind === "Event" ? target.attending : target.members;
  if (!destCircle) {
    return {
      activity,
      error: `Join: ${kind.toLowerCase()} has no ${
        kind === "Event" ? "attending" : "members"
      } circle`,
    };
  }

  const res = await Circle.updateOne(
    { id: destCircle, "members.id": { $ne: member.id } },
    { $push: { members: member }, $inc: { memberCount: 1 } }
  );

  if (res.modifiedCount > 0) {
    if (kind === "Event") {
      await Event.updateOne({ id: target.id }, { $inc: { attendingCount: 1 } });
    } else {
      await Group.updateOne({ id: target.id }, { $inc: { memberCount: 1 } });
    }
    return { activity, result: { type: kind, status: "joined" } };
  } else {
    return { activity, result: { type: kind, status: "already_joined" } };
  }
}
