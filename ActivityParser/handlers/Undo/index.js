// /ActivityParser/handlers/Undo/index.js

import {
  Activity,
  Circle,
  Event,
  Group,
  React as ReactModel,
  Flag,
} from "#schema";

/**
 * Undo handler
 * - activity.target MUST be the id of the original activity being undone
 * - Only the same actor can undo (unless you later add a moderator path)
 * - Uses original.sideEffects to deterministically reverse the local changes
 * - Returns { activity, undone, inverse, federate, undoOf? } OR { activity, error }
 */
export default async function Undo(activity) {
  try {
    // ---------------- Validate basics ----------------
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Undo: missing activity.actorId" };
    }
    if (!activity?.target || typeof activity.target !== "string") {
      return {
        activity,
        error:
          "Undo: missing or malformed activity.target (original activity id)",
      };
    }

    // ---------------- Find original ----------------
    const original =
      (await Activity.findOne({ id: activity.target })) ||
      (await Activity.findOne({ remoteId: activity.target })); // allow passing a remote id

    if (!original) {
      return { activity, error: "Undo: original activity not found" };
    }

    // ---------------- AuthZ ----------------
    if (original.actorId !== activity.actorId) {
      return { activity, error: "Undo: not authorized (actor mismatch)" };
    }

    // Helpful locals
    const inverse = { ofType: original.type, did: [] };

    // ---------------- Dispatch by original.type ----------------
    switch (original.type) {
      case "Block": {
        const { circleId, memberId } = fx;
        if (circleId && memberId) {
          await Circle.updateOne(
            { id: circleId, "members.id": memberId },
            { $pull: { members: { id: memberId } } }
          );
          inverse.did.push({ type: "pull", circleId, memberId });
        } else {
          // Best-effort: nothing to reverse safely
          return { activity, error: "Undo: Block missing sideEffects" };
        }
        break;
      }

      case "Mute": {
        const { circleId, memberId } = fx;
        if (circleId && memberId) {
          await Circle.updateOne(
            { id: circleId, "members.id": memberId },
            { $pull: { members: { id: memberId } } }
          );
          inverse.did.push({ type: "pull", circleId, memberId });
        } else {
          return { activity, error: "Undo: Mute missing sideEffects" };
        }
        break;
      }

      case "Follow": {
        // Remove followed member from the circle it was added to
        const { circleId, memberId } = fx;
        if (circleId && memberId) {
          await Circle.updateOne(
            { id: circleId, "members.id": memberId },
            { $pull: { members: { id: memberId } } }
          );
          inverse.did.push({ type: "pull", circleId, memberId });
        } else {
          return { activity, error: "Undo: Follow missing sideEffects" };
        }
        break;
      }

      case "React": {
        // Delete the React and (if present) decrement reactCount on target
        const { reactId, bumpedTargetId } = fx;
        if (reactId) {
          await ReactModel.deleteOne({ id: reactId });
          inverse.did.push({ type: "delete", reactId });
        } else {
          return { activity, error: "Undo: React missing reactId" };
        }
        if (bumpedTargetId) {
          // best-effort: $inc only if field exists
          await Promise.all([
            Event.updateOne(
              { id: bumpedTargetId },
              { $inc: { reactCount: -1 } }
            ).catch(() => {}),
            Group.updateOne(
              { id: bumpedTargetId },
              { $inc: { reactCount: -1 } }
            ).catch(() => {}),
          ]);
          inverse.did.push({
            type: "dec",
            targetId: bumpedTargetId,
            field: "reactCount",
          });
        }
        break;
      }

      case "Invite": {
        // Remove invitee from invited circle on Event/Group
        const { circleId, memberId } = fx; // invited circle id
        if (circleId && memberId) {
          await Circle.updateOne(
            { id: circleId, "members.id": memberId },
            { $pull: { members: { id: memberId } } }
          );
          inverse.did.push({ type: "pull", circleId, memberId });
        } else {
          return { activity, error: "Undo: Invite missing sideEffects" };
        }
        break;
      }

      case "Accept": {
        // Reverse Accept: pull from attending/members; optionally re-add to invited if fromInvited
        const { from, to, fromCircleId, toCircleId, memberId } = fx;
        if (!toCircleId || !memberId) {
          return { activity, error: "Undo: Accept missing sideEffects" };
        }
        // Pull from destination
        await Circle.updateOne(
          { id: toCircleId, "members.id": memberId },
          { $pull: { members: { id: memberId } } }
        );
        inverse.did.push({ type: "pull", circleId: toCircleId, memberId });

        // If we had originally come from invited, re-add there
        if (from === "invited" && fromCircleId) {
          await Circle.findOneAndUpdate(
            { id: fromCircleId, "members.id": { $ne: memberId } },
            { $push: { members: { id: memberId } } }
          );
          inverse.did.push({ type: "push", circleId: fromCircleId, memberId });
        }
        break;
      }

      case "Add": {
        // Demote: pull subject from admins/moderators circle
        const { circleId, memberId, role } = fx;
        if (!circleId || !memberId) {
          return { activity, error: "Undo: Add missing sideEffects" };
        }
        await Circle.updateOne(
          { id: circleId, "members.id": memberId },
          { $pull: { members: { id: memberId } } }
        );
        inverse.did.push({ type: "pull", circleId, memberId, role });
        break;
      }

      case "Remove": {
        // Re-add subject IF we recorded the prior circle in sideEffects
        const { circleId, member, role } = fx; // member is full subdoc if we stored it
        if (!circleId || !member?.id) {
          return { activity, error: "Undo: Remove missing sideEffects" };
        }
        await Circle.findOneAndUpdate(
          { id: circleId, "members.id": { $ne: member.id } },
          { $push: { members: member } }
        );
        inverse.did.push({ type: "push", circleId, memberId: member.id, role });
        break;
      }

      case "Delete": {
        // Un-delete soft deletes
        const { softDeletedId, model } = fx; // e.g., { model: "Post", softDeletedId: "<id>" }
        if (!softDeletedId || !model) {
          return { activity, error: "Undo: Delete missing sideEffects" };
        }
        const Models = { Event, Group /* add Post, Page, Reply, etc. here */ };
        const M = Models[model];
        if (!M) {
          return { activity, error: `Undo: unsupported model "${model}"` };
        }
        await M.updateOne(
          { id: softDeletedId },
          { $set: { deletedAt: null, deletedBy: null } }
        );
        inverse.did.push({
          type: "unset",
          model,
          id: softDeletedId,
          fields: ["deletedAt", "deletedBy"],
        });
        break;
      }

      case "Flag": {
        // Withdraw user's own open flag (or delete); keep it simple: mark closed
        const { flagId } = fx;
        if (!flagId)
          return { activity, error: "Undo: Flag missing sideEffects" };
        await Flag.updateOne(
          { id: flagId },
          { $set: { status: "withdrawn", updatedAt: new Date() } }
        );
        inverse.did.push({
          type: "update",
          model: "Flag",
          id: flagId,
          status: "withdrawn",
        });
        break;
      }

      default:
        return {
          activity,
          error: `Undo: original type "${original.type}" is not undoable`,
        };
    }

    // ---------------- Federation hint ----------------
    const federate = Boolean(original.remoteId);
    const res = {
      activity,
      undone: true,
      inverse,
      federate,
      ...(federate ? { undoOf: original.remoteId } : {}),
    };

    // Optionally mark this Undo as referencing original
    activity.undoOf = original.id;

    return res;
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
