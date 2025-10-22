// #ActivityParser/handlers/Invite/index.js
// Invites a user to an Event or Group by adding them to the target's `invited` circle.
// Permissions: creator or admin/mods (Group); creator or admins (Event).
// Notes: no sideEffects stored; writes happen directly here.

import { Event, Group, Circle, User } from "#schema";

export default async function Invite(activity, ctx = {}) {
  const inviterId = activity.actorId;
  const targetRef =
    activity.target ||
    (typeof activity.object === "string"
      ? activity.object
      : activity.object?.id);

  // Who is being invited?
  const inviteeId =
    typeof activity.object === "string"
      ? activity.object
      : activity.object?.actorId || activity.object?.id;

  if (!inviterId || !targetRef || !inviteeId) {
    return {
      activity,
      error: "Invite: missing inviterId, target, or inviteeId",
    };
  }

  // Resolve target: Event or Group
  let kind = null;
  let target = null;

  if (typeof targetRef === "string" && targetRef.startsWith("event:")) {
    target = await Event.findOne({ id: targetRef }).lean();
    kind = target ? "Event" : null;
  } else if (typeof targetRef === "string" && targetRef.startsWith("group:")) {
    target = await Group.findOne({ id: targetRef }).lean();
    kind = target ? "Group" : null;
  }

  if (!target) {
    target = await Event.findOne({ id: targetRef }).lean();
    kind = target ? "Event" : null;
  }
  if (!target) {
    target = await Group.findOne({ id: targetRef }).lean();
    kind = target ? "Group" : null;
  }
  if (!target) return { activity, error: "Invite: target not found" };

  // Permission check
  const isCreator = target.actorId === inviterId;

  async function inCircle(id) {
    if (!id) return false;
    return !!(await Circle.exists({ id, "members.id": inviterId }));
  }

  const canInvite =
    isCreator ||
    (kind === "Group" &&
      ((await inCircle(target.admins)) ||
        (await inCircle(target.moderators)))) ||
    (kind === "Event" && (await inCircle(target.admins)));

  if (!canInvite) {
    return {
      activity,
      error: `Invite: actor not permitted to invite to this ${kind.toLowerCase()}`,
    };
  }

  // Blocked check (cannot invite blocked users)
  if (target.blocked) {
    const isBlocked = await Circle.exists({
      id: target.blocked,
      "members.id": inviteeId,
    });
    if (isBlocked) {
      return {
        activity,
        error: `Invite: user is blocked from this ${kind.toLowerCase()}`,
      };
    }
  }

  const invitedCircle = target.invited;
  if (!invitedCircle) {
    return {
      activity,
      error: `Invite: this ${kind.toLowerCase()} has no 'invited' circle configured`,
    };
  }

  // Build member object (enrich if local)
  const u = await User.findOne({ id: inviteeId }).lean();
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
    : { id: inviteeId };

  // Add to invited (no dupes)
  const res = await Circle.updateOne(
    { id: invitedCircle, "members.id": { $ne: member.id } },
    { $push: { members: member }, $inc: { memberCount: 1 } }
  );

  const status = res.modifiedCount > 0 ? "invited" : "already_invited";
  return { activity, result: { type: kind, status, inviteeId } };
}
