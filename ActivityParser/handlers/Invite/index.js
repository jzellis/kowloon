// /ActivityParser/handlers/Invite/index.js

import { Event, Group, Circle, User } from "#schema";
import objectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function Invite(activity) {
  try {
    // ---- Basic validation ----
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Invite: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error: "Invite: missing or malformed activity.target",
      };
    }
    if (!activity?.to || typeof activity.to !== "string") {
      return {
        activity,
        error: "Invite: missing or malformed activity.to (invitee id)",
      };
    }
    if (activity.to === activity.actorId) {
      return { activity, error: "Invite: cannot invite yourself" };
    }

    // ---- Resolve local target (Event or Group). If not found → federate only. ----
    let targetType = null;
    let eventDoc = await Event.findOne({ id: activity.target });
    let groupDoc = null;

    if (eventDoc) targetType = "Event";
    else {
      groupDoc = await Group.findOne({ id: activity.target });
      if (groupDoc) targetType = "Group";
    }

    if (!targetType) {
      // Remote target → do not mutate locally; let upstream federate.
      return { activity, federate: true };
    }

    // ---- Deleted guard ----
    if (eventDoc?.deletedAt)
      return { activity, error: "Invite: event is deleted" };
    if (groupDoc?.deletedAt)
      return { activity, error: "Invite: group is deleted" };

    // ---- Load inviter (must exist locally) ----
    const inviter = await User.findOne({ id: activity.actorId }).lean();
    if (!inviter)
      return {
        activity,
        error: `Invite: inviter user not found: ${activity.actorId}`,
      };

    // ---- Resolve invitee (local vs remote) & build Member subdoc ----
    const inviteeId = activity.to;
    const inviteeLocal = await objectById(inviteeId); // null if remote/unknown
    const inviteeParsed = kowloonId(inviteeId);

    const member = inviteeLocal
      ? {
          id: inviteeLocal.id,
          name: inviteeLocal?.profile?.name,
          url: inviteeLocal?.url,
          icon: inviteeLocal?.profile?.icon,
          inbox: inviteeLocal?.inbox,
          outbox: inviteeLocal?.outbox,
          server: inviteeLocal?.server ?? inviteeParsed?.domain,
        }
      : {
          id: inviteeId,
          url: inviteeParsed?.type === "URL" ? inviteeId : undefined,
          server: inviteeParsed?.domain,
        };

    // ---- Helpers (circle ops) ----
    const isMember = async (circleId, userId) =>
      !!(
        circleId &&
        userId &&
        (await Circle.findOne({ id: circleId, "members.id": userId }).lean())
      );

    const addMemberIfMissing = async (circleId, m) =>
      Circle.findOneAndUpdate(
        { id: circleId, "members.id": { $ne: m.id } },
        { $push: { members: m }, $set: { updatedAt: new Date() } },
        { new: true }
      );

    // ========================================================================
    // EVENT INVITE
    // inviter must be in event.admins OR event.attending
    // de-dupe: skip if invitee already in attending OR invited
    // blocked: if invitee in event.blocked → error
    // ========================================================================
    if (targetType === "Event") {
      const adminsId = eventDoc.admins;
      const attendingId = eventDoc.attending;
      const invitedId = eventDoc.invited;
      const blockedId = eventDoc.blocked;

      if (!adminsId || !attendingId || !invitedId) {
        return { activity, error: "Invite: event circles not initialized" };
      }

      if (blockedId && (await isMember(blockedId, inviteeId))) {
        return {
          activity,
          error: "Invite: invitee is blocked from this event",
        };
      }

      const inviterIsAdmin = await isMember(adminsId, activity.actorId);
      const inviterIsAttending = await isMember(attendingId, activity.actorId);

      if (!inviterIsAdmin && !inviterIsAttending) {
        return {
          activity,
          error:
            "Invite: inviter must be an event admin or currently attending",
        };
      }

      const inviteeAttending = await isMember(attendingId, inviteeId);
      const inviteeInvited = await isMember(invitedId, inviteeId);

      if (inviteeAttending || inviteeInvited) {
        activity.objectId = inviteeId;
        return { activity, event: eventDoc, invited: false, federate: false };
      }

      const updatedInvited = await addMemberIfMissing(invitedId, member);
      if (!updatedInvited) {
        return {
          activity,
          error: "Invite: failed to add to event invited circle",
        };
      }

      // annotate for Undo
      activity.objectId = inviteeId;
      activity.sideEffects = {
        circleId: invitedId,
        memberId: inviteeId,
      };

      return {
        activity,
        event: eventDoc,
        invited: true,
        federate: !inviteeLocal, // federate if invitee isn't local
      };
    }

    // ========================================================================
    // GROUP INVITE
    // inviter must be in group.admins OR group.members
    // de-dupe: skip if invitee already in members OR invited
    // blocked: if invitee in group's blocked circle → error
    // ========================================================================
    const adminsId = groupDoc.admins;
    const membersId = groupDoc.members;
    const invitedId = groupDoc.invited;
    const blockedId = groupDoc.blocked;

    if (!adminsId || !membersId || !invitedId) {
      return { activity, error: "Invite: group circles not initialized" };
    }

    if (blockedId && (await isMember(blockedId, inviteeId))) {
      return { activity, error: "Invite: invitee is blocked from this group" };
    }

    const inviterIsAdmin = await isMember(adminsId, activity.actorId);
    const inviterIsMember = await isMember(membersId, activity.actorId);

    if (!inviterIsAdmin && !inviterIsMember) {
      return {
        activity,
        error: "Invite: inviter must be a group admin or member",
      };
    }

    const inviteeMember = await isMember(membersId, inviteeId);
    const inviteeInvited = await isMember(invitedId, inviteeId);

    if (inviteeMember || inviteeInvited) {
      activity.objectId = inviteeId;
      return { activity, group: groupDoc, invited: false, federate: false };
    }

    const updatedInvited = await addMemberIfMissing(invitedId, member);
    if (!updatedInvited) {
      return {
        activity,
        error: "Invite: failed to add to group invited circle",
      };
    }

    // annotate for Undo
    activity.objectId = inviteeId;
    activity.sideEffects = {
      circleId: invitedId,
      memberId: inviteeId,
    };

    return {
      activity,
      group: groupDoc,
      invited: true,
      federate: !inviteeLocal, // federate if invitee isn't local
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
