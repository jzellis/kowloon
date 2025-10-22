// #ActivityParser/handlers/Accept/index.js
// Accepts a pending join for an Event/Group (admin/mod approval), OR
// (optionally) lets an invited user self-accept by moving from `invited` to membership.

import { Event, Group, Circle, User } from "#schema";

export default async function Accept(activity, ctx = {}) {
  const actorId = activity.actorId;
  const targetRef =
    activity.target ||
    (typeof activity.object === "string"
      ? activity.object
      : activity.object?.id);

  // Who is being accepted? (subject of acceptance)
  // If omitted, assume self-accept (actorId).
  let subjectId =
    typeof activity.object === "string"
      ? activity.object
      : activity.object?.actorId || activity.object?.id || actorId;

  if (!actorId || !targetRef) {
    return { activity, error: "Accept: missing actorId or target" };
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
  if (!target) return { activity, error: "Accept: target not found" };

  // Two acceptance modes:
  // A) Admin/mod approves a pending request (actorId ≠ subjectId)
  // B) Invitee self-accepts an invitation (actorId === subjectId)

  const isSelfAccept = actorId === subjectId;

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

  // Self-accept path: ensure subject was invited
  if (isSelfAccept) {
    if (!target.invited) {
      return {
        activity,
        error: `Accept: ${kind.toLowerCase()} has no 'invited' circle configured`,
      };
    }
    const isInvited = await Circle.exists({
      id: target.invited,
      "members.id": subjectId,
    });
    if (!isInvited) {
      return { activity, error: "Accept: not invited" };
    }
  } else {
    // Admin approval path: check permissions
    if (!(await actorHasAdminPower())) {
      return { activity, error: "Accept: actor not permitted to approve" };
    }
  }

  // Determine source (pending) and destination (membership) circles
  const pendingCircle =
    kind === "Event" ? target.interested : target.requests;
  const memberCircle = kind === "Event" ? target.attending : target.members;

  if (!memberCircle) {
    return {
      activity,
      error: `Accept: ${kind.toLowerCase()} has no ${
        kind === "Event" ? "attending" : "members"
      } circle`,
    };
  }

  // If self-accept, remove from invited; if admin-accept, remove from pending
  if (isSelfAccept) {
    if (target.invited) {
      await Circle.updateOne(
        { id: target.invited },
        { $pull: { members: { id: subjectId } }, $inc: { memberCount: -1 } }
      );
    }
  } else if (pendingCircle) {
    await Circle.updateOne(
      { id: pendingCircle },
      { $pull: { members: { id: subjectId } }, $inc: { memberCount: -1 } }
    );
  }

  // Add to membership circle (no dupes)
  // Enrich member if local
  const u = await User.findOne({ id: subjectId }).lean();
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
    : { id: subjectId };

  const res = await Circle.updateOne(
    { id: memberCircle, "members.id": { $ne: member.id } },
    { $push: { members: member }, $inc: { memberCount: 1 } }
  );

  if (res.modifiedCount > 0) {
    if (kind === "Event") {
      await Event.updateOne({ id: target.id }, { $inc: { attendingCount: 1 } });
    } else {
      await Group.updateOne({ id: target.id }, { $inc: { memberCount: 1 } });
    }
    return {
      activity,
      result: {
        type: kind,
        mode: isSelfAccept ? "self" : "admin",
        status: "accepted",
        subjectId,
      },
    };
  } else {
    return {
      activity,
      result: {
        type: kind,
        mode: isSelfAccept ? "self" : "admin",
        status: "already_member",
        subjectId,
      },
    };
  }
}
