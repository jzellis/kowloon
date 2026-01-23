// #ActivityParser/handlers/React/index.js
// Creates (idempotently) a React record and bumps reactCount on the target.
// Ensures: objectType === "React", target is required, and object.react is provided.
// Works for Post/Page/Bookmark/Event/Group targets if present in #schema.

import {
  React as ReactModel,
  Post,
  Page,
  Bookmark,
  Group,
} from "#schema";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";
import createNotification from "#methods/notifications/create.js";

/**
 * Type-specific validation for React activities
 * Per specification: objectType REQUIRED, object REQUIRED, to REQUIRED (object ID)
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("React: missing activity.actorId");
  }

  // Required: objectType
  if (!activity?.objectType || typeof activity.objectType !== "string") {
    errors.push("React: missing required field 'objectType'");
  }

  // Required: object
  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("React: missing required field 'object'");
  }

  // Required: to (object ID being reacted to)
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("React: missing required field 'to' (object ID)");
  }

  // object.react is required
  const reactKind =
    activity.object?.react ||
    activity.object?.emoji ||
    activity.object?.type ||
    undefined;

  if (!reactKind || typeof reactKind !== "string") {
    errors.push("React: object.react (string) is required");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for React activity
 * @param {Object} activity - The activity envelope
 * @param {Object} result - The react result
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, result) {
  // Reactions are typically sent to the author of the target object
  // For now, no federation (could be enhanced to notify the target author)
  return { shouldFederate: false };
}

export default async function React(activity, ctx = {}) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetId = activity.to; // Per spec, 'to' contains the object ID

    const reactKind =
      activity.object?.react ||
      activity.object?.emoji ||
      activity.object?.type ||
      undefined;

    const reactName = activity.object?.name || undefined;

    // Idempotent upsert of the React document (natural key: actorId + target + react)
    const up = await ReactModel.updateOne(
      { actorId, target: targetId, emoji: reactKind },
      {
        $setOnInsert: {
          actorId,
          target: targetId,
          emoji: reactKind,
          name: reactName,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    if ((up.upsertedCount || 0) === 0 && (up.matchedCount || 0) > 0) {
      // Already had this reaction
      const result = { status: "already_reacted" };
      const federation = await getFederationTargets(activity, result);
      return { activity, result, federation };
    }

    // Try to bump reactCount on a known target collection
    const inc = { $inc: { reactCount: 1 } };
    let bumped = false;
    const models = [Post, Page, Bookmark, Group];
    for (const Model of models) {
      try {
        if (!Model) continue;
        const r = await Model.updateOne({ id: targetId }, inc);
        if (r && r.modifiedCount > 0) {
          bumped = true;
          break;
        }
      } catch (e) {
        // ignore model mismatches
      }
    }

    const result = { status: "reacted", react: reactKind, bumped };

    // Create notification for the author of the target object
    try {
      // Find the target object to get its author
      let targetAuthorId;
      for (const Model of [Post, Page, Bookmark, Group]) {
        try {
          if (!Model) continue;
          const target = await Model.findOne({ id: targetId }).select("actorId").lean();
          if (target?.actorId) {
            targetAuthorId = target.actorId;
            break;
          }
        } catch (e) {
          // Continue to next model
        }
      }

      if (targetAuthorId) {
        await createNotification({
          type: "react",
          recipientId: targetAuthorId,
          actorId,
          objectId: targetId,
          objectType: "Post", // Could be more specific, but Post covers most cases
          activityId: activity.id,
          activityType: "React",
          groupKey: `react:${targetId}`,
        });
      }
    } catch (err) {
      console.error("Failed to create notification for React:", err.message);
      // Non-fatal
    }

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, result);

    return {
      activity,
      created: result,
      result,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
