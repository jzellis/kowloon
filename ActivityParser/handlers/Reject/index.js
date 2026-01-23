import { Event, Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import toMember from "#methods/parse/toMember.js";

export default async function Reject(activity) {
  try {
    const { actorId, target, object } = activity;
    if (!actorId || typeof actorId !== "string") {
      return { activity, error: "Reject: missing actorId" };
    }
    if (!target || typeof target !== "string") {
      return { activity, error: "Reject: missing or malformed target" };
    }

    // Resolve target: Event or Group
    let kind = null;
    let tgt = await Event.findOne({ id: target }).lean();
    if (tgt) kind = "Event";
    if (!tgt) {
      tgt = await Group.findOne({ id: target }).lean();
      if (tgt) kind = "Group";
    }
    if (!tgt) return { activity, error: "Reject: target not found" };

    // --- Self-reject of an Invite (invitee declines) ---
    // No need for `object` (activity id) in this mode
    const invitee = await User.findOne({ id: actorId }).lean();
    if (!invitee) return { activity, error: "Reject: actor not found" };

    if (!tgt.invited) {
      return {
        activity,
        error: `Reject: ${kind?.toLowerCase()} has no 'invited' circle`,
      };
    }

    // Remove from invited circle if present
    const pullRes = await Circle.updateOne(
      { id: tgt.invited, "members.id": actorId },
      { $pull: { members: { id: actorId } }, $inc: { memberCount: -1 } }
    );

    const removed = (pullRes.modifiedCount || 0) > 0;

    return {
      activity,
      result: {
        type: kind,
        mode: "self",
        rejected: removed ? "removed_from_invited" : "not_found_in_invited",
        subjectId: actorId,
      },
      federate: false,
    };

    // --- If you also support admin rejecting a pending Join, keep your
    // existing branch below this return, or gate on `object` being present. ---
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
