// #ActivityParser/handlers/Join/index.js
import { Group, Circle, User } from "#schema";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";
import createNotification from "#methods/notifications/create.js";

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
    if (target.circles?.blocked) {
      const isBlocked = await Circle.exists({
        id: target.circles.blocked,
        "members.id": actorId,
      });
      if (isBlocked)
        return {
          activity,
          error: "Join: user is blocked from this group",
        };
    }

    // Policy
    const policy = target.rsvpPolicy || "open";

    if (policy === "approval") {
      // Add to pending circle for admin approval
      const pendingCircle = target.circles?.pending;
      if (!pendingCircle) {
        return {
          activity,
          error: "Join: approval pending queue not configured for this group",
        };
      }

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

      const updateRes = await Circle.updateOne(
        { id: pendingCircle, "members.id": { $ne: actorId } },
        { $push: { members: member }, $inc: { memberCount: 1 } }
      );

      // Notify all group admins about the join request (only if actually added to pending)
      if (updateRes.modifiedCount > 0 && target.circles?.admins) {
        try {
          const adminCircle = await Circle.findOne({ id: target.circles.admins })
            .select("members")
            .lean();

          if (adminCircle?.members?.length > 0) {
            // Create notification for each admin
            await Promise.all(
              adminCircle.members.map((admin) =>
                createNotification({
                  type: "join_request",
                  recipientId: admin.id,
                  actorId,
                  objectId: targetId,
                  objectType: "Group",
                  activityId: activity.id,
                  activityType: "Join",
                  groupKey: `join_request:${targetId}:${actorId}`,
                })
              )
            );
          }
        } catch (err) {
          console.error("Failed to create join_request notifications:", err.message);
          // Non-fatal
        }
      }

      const result = { type: "Group", status: "pending" };
      const federation = await getFederationTargets(activity, result);

      return {
        activity,
        created: result,
        result,
        federation,
      };
    } else if (policy !== "open") {
      return { activity, error: `Join: unsupported policy "${policy}"` };
    }
    // Proceed for open policy

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

    const destCircle = target.circles?.members;
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
