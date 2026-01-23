// #ActivityParser/handlers/Accept/index.js
// Accepts a pending join for a Group (admin/mod approval), OR
// (optionally) lets an invited user self-accept by moving from `invited` to membership.

import { Group, Circle, User } from "#schema";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";

/**
 * Type-specific validation for Accept activities
 * Per specification: to (Group ID) is REQUIRED
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Accept: missing activity.actorId");
  }

  // Required: to (Group ID)
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("Accept: missing required field 'to' (Group ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Accept activity
 * @param {Object} activity - The activity envelope
 * @param {Object} result - The accept result
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, result) {
  // Accept activities should notify the accepted user
  // For now, no federation (could be enhanced to notify the subject)
  return { shouldFederate: false };
}

export default async function Accept(activity, ctx = {}) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetRef = activity.to; // Group ID per spec

    // Who is being accepted? (subject of acceptance)
    // If omitted, assume self-accept (actorId).
    let subjectId =
      typeof activity.object === "string"
        ? activity.object
        : activity.object?.actorId || activity.object?.id || actorId;

    // Resolve target: Group only (Events are now Posts)
    const target = await Group.findOne({ id: targetRef }).lean();

    if (!target) {
      return { activity, error: "Accept: Group not found" };
    }

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
        target.moderators &&
        (await Circle.exists({ id: target.moderators, "members.id": actorId }));
      return isCreator || inAdmins || !!inMods;
    }

    // Self-accept path: ensure subject was invited
    if (isSelfAccept) {
      if (!target.invited) {
        return {
          activity,
          error: "Accept: group has no 'invited' circle configured",
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
    const pendingCircle = target.requests;
    const memberCircle = target.members;

    if (!memberCircle) {
      return {
        activity,
        error: "Accept: group has no members circle",
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
      await Group.updateOne({ id: target.id }, { $inc: { memberCount: 1 } });

      const result = {
        type: "Group",
        mode: isSelfAccept ? "self" : "admin",
        status: "accepted",
        subjectId,
      };

      // 3. Determine federation requirements
      const federation = await getFederationTargets(activity, result);

      return {
        activity,
        created: result,
        result,
        federation,
      };
    } else {
      const result = {
        type: "Group",
        mode: isSelfAccept ? "self" : "admin",
        status: "already_member",
        subjectId,
      };

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
