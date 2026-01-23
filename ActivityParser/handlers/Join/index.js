// #ActivityParser/handlers/Join/index.js
import { Group, Circle, User } from "#schema";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";

/**
 * Type-specific validation for Join activities
 * Per specification: target (Group ID) is REQUIRED
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Join: missing activity.actorId");
  }

  // Required: target (Group ID)
  if (!activity?.target || typeof activity.target !== "string") {
    errors.push("Join: missing required field 'target' (Group ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Join activity
 * @param {Object} activity - The activity envelope
 * @param {Object} result - The join result
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, result) {
  // Join activities could notify group members
  // For now, no federation (could be enhanced)
  return { shouldFederate: false };
}

export default async function Join(activity, ctx = {}) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetId = activity.target;

    // Resolve target: Group only (Events are now Posts)
    const target = await Group.findOne({ id: targetId }).lean();

    if (!target) {
      return { activity, error: "Join: Group not found" };
    }

    // Blocked check
    if (target.blocked) {
      const isBlocked = await Circle.exists({
        id: target.blocked,
        "members.id": actorId,
      });
      if (isBlocked)
        return {
          activity,
          error: "Join: user is blocked from this group",
        };
    }

    // Policy
    const policy = target.rsvpPolicy || "invite_only";

    if (policy === "invite_only") {
      const invitedCircle = target.invited;
      if (!invitedCircle) {
        return {
          activity,
          error: "Join: invite required (group is invite_only)",
        };
      }
      const invited = await Circle.exists({
        id: invitedCircle,
        "members.id": actorId,
      });
      if (!invited) {
        return {
          activity,
          error: "Join: invite required (group is invite_only)",
        };
      }
    } else if (policy === "approval") {
      // enqueue request/pending
      const pendingCircle = target.requests;
      if (pendingCircle) {
        await Circle.updateOne(
          { id: pendingCircle, "members.id": { $ne: actorId } },
          { $push: { members: { id: actorId } }, $inc: { memberCount: 1 } }
        );

        const result = { type: "Group", status: "pending" };
        const federation = await getFederationTargets(activity, result);

        return {
          activity,
          created: result,
          result,
          federation,
        };
      }
      return {
        activity,
        error: "Join: approval pending queue not configured for this group",
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

    const destCircle = target.members;
    if (!destCircle) {
      return {
        activity,
        error: "Join: group has no members circle",
      };
    }

    const res = await Circle.updateOne(
      { id: destCircle, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );

    if (res.modifiedCount > 0) {
      await Group.updateOne({ id: target.id }, { $inc: { memberCount: 1 } });

      const result = { type: "Group", status: "joined" };
      const federation = await getFederationTargets(activity, result);

      return {
        activity,
        created: result,
        result,
        federation,
      };
    } else {
      const result = { type: "Group", status: "already_joined" };
      const federation = await getFederationTargets(activity, result);

      return {
        activity,
        created: result,
        result,
        federation,
      };
    }
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
