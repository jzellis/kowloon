// #ActivityParser/handlers/Reject/index.js
// Rejects a pending join (approval flow) or declines/rescinds an invite.
// - Events: pending circle = `interested`, membership = `attending`
// - Groups: pending circle = `requests`,   membership = `members`
// Permissions:
//   • Pending rejection: creator/admins (and moderators for Groups).
//   • Invite decline: invitee may self-decline; admins may rescind.

import { Event, Group, Circle, User } from "#schema";

export default async function Reject(activity, ctx = {}) {
  const actorId = activity.actorId;
  const targetRef =
    activity.target ||
    (typeof activity.object === "string"
      ? activity.object
      : activity.object?.id);

  // Who is being rejected? If omitted, assume self (actorId).
  const subjectId =
    typeof activity.object === "string"
      ? activity.object
      : activity.object?.actorId || activity.object?.id || actorId;

  if (!actorId || !targetRef) {
    return { activity, error: "Reject: missing actorId or target" };
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
  if (!target) return { activity, error: "Reject: target not found" };

  const isSelf = actorId === subjectId;

  async function actorHasAdminPower() {
    const isCreator = target.actorId === actorId;
    const inAdmins =
      target.admins &&
      (await Circle.exists({ id: target.admins, "members.id": actorId }));
    const inMods =
      kind === "Group" &&
      target.moderators &&
      (await Circle.exists({ id: target.moderators, "members.id": actorId }));
    return isCreator || inAdmins || !!inMods;
  }

  const invitedCircle = target.invited;
  const pendingCircle = kind === "Event" ? target.interested : target.requests;

  // Determine what we're rejecting by checking circle membership
  const subjectInvited =
    invitedCircle &&
    (await Circle.exists({ id: invitedCircle, "members.id": subjectId }));
  const subjectPending =
    pendingCircle &&
    (await Circle.exists({ id: pendingCircle, "members.id": subjectId }));

  // Case 1: Reject pending join (requires admin/mod permissions)
  if (subjectPending) {
    if (!(await actorHasAdminPower())) {
      return {
        activity,
        error: "Reject: actor not permitted to reject pending request",
      };
    }

    // Remove from pending
    const res = await Circle.updateOne(
      { id: pendingCircle },
      { $pull: { members: { id: subjectId } }, $inc: { memberCount: -1 } }
    );

    // If you track interestedCount on Events, decrement it too
    if (kind === "Event") {
      await Event.updateOne(
        { id: target.id },
        { $inc: { interestedCount: -1 } }
      );
    }

    const status = res.modifiedCount > 0 ? "rejected" : "not_found";
    return {
      activity,
      result: { type: kind, action: "pending", status, subjectId },
    };
  }

  // Case 2: Decline/rescind an invitation
  if (subjectInvited) {
    // Self-decline allowed; admins/mods may rescind as well
    if (!isSelf && !(await actorHasAdminPower())) {
      return {
        activity,
        error: "Reject: actor not permitted to rescind invitation",
      };
    }

    const res = await Circle.updateOne(
      { id: invitedCircle },
      { $pull: { members: { id: subjectId } }, $inc: { memberCount: -1 } }
    );

    const mode = isSelf ? "self" : "admin";
    const status = res.modifiedCount > 0 ? "declined" : "not_found";
    return {
      activity,
      result: { type: kind, action: "invite", mode, status, subjectId },
    };
  }

  // Nothing to reject
  return {
    activity,
    error: "Reject: no pending request or invitation found for subject",
  };
}
