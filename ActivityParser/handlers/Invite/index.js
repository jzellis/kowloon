// #ActivityParser/handlers/Invite/index.js
import { Event, Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Invite(activity) {
  try {
    const { actorId, object, target } = activity;
    if (!actorId || !object || !target) {
      return { activity, error: "Invite: missing actorId, object, or target" };
    }

    // Resolve target (Event/Group)
    let kind = null;
    let tgt = await Event.findOne({ id: target }).lean();
    if (tgt) kind = "Event";
    if (!tgt) {
      tgt = await Group.findOne({ id: target }).lean();
      if (tgt) kind = "Group";
    }
    if (!tgt) return { activity, error: "Invite: target not found" };

    // Require an invited circle on the target
    if (!tgt.invited) {
      return {
        activity,
        error: `Invite: ${kind.toLowerCase()} has no 'invited' circle`,
      };
    }

    // Normalize the invitee to a member subdoc
    let inviteeId =
      typeof object === "string" ? object : object?.actorId || object?.id;
    if (!inviteeId)
      return { activity, error: "Invite: invalid object (user to invite)" };

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

    // Add to invited circle (no duplicates)
    const res = await Circle.updateOne(
      { id: tgt.invited, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );

    return {
      activity,
      result: {
        type: kind,
        invited: res.modifiedCount > 0 ? "added" : "already_invited",
        subjectId: member.id,
      },
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
