// #ActivityParser/handlers/React/index.js
//
// A user has exactly ONE reaction per target. A React activity SETS that
// reaction (creating or replacing it); a React activity with an empty/omitted
// emoji CLEARS it (un-react). This single-activity model replaces the old
// per-(user,target,emoji) upsert + separate Undo path.
//
//   emoji present, none existing  -> add        (notify author, reactCount +1)
//   emoji present, different one  -> replace     (no notify, count unchanged)
//   emoji present, same as before -> no-op
//   emoji empty/omitted, existing -> remove      (reactCount -1)
//   emoji empty/omitted, none     -> no-op
//
// Peer Kowloon servers run this same handler, so an empty React federates cleanly
// as a "clear". (Incoming ActivityPub Undo{Like} is handled in the Undo handler.)

import {
  React as ReactModel,
  Post,
  Reply,
  Page,
  Bookmark,
  Group,
  Circle,
  User,
  FeedItems,
} from "#schema";
import createNotification from "#methods/notifications/create.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import getMultiFederationTargets from "../utils/getMultiFederationTargets.js";

const TARGET_MODELS = [Post, Reply, Page, Bookmark, Group, Circle];

/**
 * Aggregate reactions for a target: top emoji, distinct-emoji summary string,
 * and the total count (which, one-per-user, is the number of reactors).
 */
async function summarizeReacts(targetId) {
  const groups = await ReactModel.aggregate([
    { $match: { target: targetId } },
    { $group: { _id: "$emoji", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  const emojis = groups.map((g) => g._id).filter(Boolean);
  return {
    top: emojis[0] ?? null,
    summary: emojis.length ? emojis.join("") : null,
    count: groups.reduce((n, g) => n + g.count, 0),
  };
}

/**
 * Recompute the target's reactCount / reactPreview / reactSummary from the
 * React collection and write them to the source model + FeedItems cache. Using
 * a recomputed count (not +1/-1) keeps it correct across add/replace/clear.
 */
export async function syncTargetReactState(targetId) {
  const { top, summary, count } = await summarizeReacts(targetId);
  for (const Model of TARGET_MODELS) {
    try {
      if (!Model) continue;
      const r = await Model.updateOne(
        { id: targetId },
        { $set: { reactCount: count, reactPreview: top, reactSummary: summary } }
      );
      if (r?.matchedCount > 0) break;
    } catch {
      /* ignore model mismatches */
    }
  }
  try {
    await FeedItems.updateOne(
      { "object.id": targetId },
      {
        $set: {
          "object.reactCount": count,
          "object.reactPreview": top,
          "object.reactSummary": summary,
        },
      }
    );
  } catch {
    /* non-fatal — display-only fields */
  }
  return count;
}

/**
 * Type-specific validation for React activities.
 * objectType/object/to are required; the emoji is OPTIONAL (empty = un-react).
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("React: missing activity.actorId");
  }
  if (!activity?.objectType || typeof activity.objectType !== "string") {
    errors.push("React: missing required field 'objectType'");
  }
  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("React: missing required field 'object'");
  }
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("React: missing required field 'to' (object ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for React activity.
 */
export async function getFederationTargets(activity) {
  const targetId = activity.to;
  if (!targetId) return { shouldFederate: false };

  const parsed = kowloonId(targetId);
  const { domain: serverDomain } = getServerSettings();

  if (!parsed.domain || parsed.domain.toLowerCase() === serverDomain?.toLowerCase()) {
    return { shouldFederate: false };
  }
  return { shouldFederate: true, scope: "domain", domains: [parsed.domain] };
}

export default async function React(activity, ctx = {}) {
  try {
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetId = activity.to;
    const reactKind =
      activity.object?.react ||
      activity.object?.emoji ||
      activity.object?.type ||
      null;
    const reactName = activity.object?.name || undefined;
    // Empty / omitted emoji means "remove my reaction".
    const clearing = typeof reactKind !== "string" || reactKind.trim() === "";

    // This user's current reaction(s) on this target. The old model allowed
    // more than one; collapse to a single reaction on any write.
    const existing = await ReactModel.find({ actorId, target: targetId })
      .select("emoji")
      .lean();
    const hadAny = existing.length > 0;
    const alreadyThis =
      !clearing && existing.length === 1 && existing[0].emoji === reactKind;

    let status;
    let isNew = false;
    let changed = false;

    if (clearing) {
      if (hadAny) {
        await ReactModel.deleteMany({ actorId, target: targetId });
        status = "unreacted";
        changed = true;
      } else {
        status = "no_change";
      }
    } else if (alreadyThis) {
      status = "already_reacted";
    } else {
      // Add or replace — collapse to exactly one reaction with the new emoji.
      if (hadAny) await ReactModel.deleteMany({ actorId, target: targetId });
      await ReactModel.create({
        actorId,
        target: targetId,
        emoji: reactKind,
        name: reactName,
      });
      isNew = !hadAny;
      status = isNew ? "reacted" : "replaced";
      changed = true;
    }

    if (!changed) {
      return { activity, result: { status }, federation: { shouldFederate: false } };
    }

    // Recompute the target's react state from the collection.
    await syncTargetReactState(targetId);

    // Track the actor's own reaction tally (targets they've reacted to).
    try {
      if (isNew) {
        await User.updateOne({ id: actorId }, { $inc: { reactCount: 1 } });
      } else if (clearing) {
        await User.updateOne({ id: actorId }, { $inc: { reactCount: -1 } });
      }
    } catch {
      /* non-fatal */
    }

    const result = { status, react: clearing ? null : reactKind };

    // Target author + parent (for notification + federation).
    let targetAuthorId;
    let parentId;
    for (const Model of [Post, Reply, Page, Bookmark, Group]) {
      try {
        if (!Model) continue;
        const target = await Model.findOne({ id: targetId })
          .select("actorId target")
          .lean();
        if (target?.actorId) {
          targetAuthorId = target.actorId;
          parentId = target.target;
          break;
        }
      } catch {
        /* continue */
      }
    }

    // Notify the author ONLY on a brand-new reaction (not replace/clear).
    if (isNew && targetAuthorId) {
      try {
        const recipient = await User.findOne({ id: targetAuthorId })
          .select("prefs")
          .lean();
        if (recipient?.prefs?.notifications?.react !== false) {
          await createNotification({
            type: "react",
            recipientId: targetAuthorId,
            actorId,
            objectId: targetId,
            objectType: "Post",
            activityId: activity.id,
            activityType: "React",
            groupKey: `react:${targetId}`,
          });
        }
      } catch (err) {
        console.error("Failed to create notification for React:", err.message);
      }
    }

    // Federation — deliver the React (add/replace/clear) to the target's host,
    // the author's home, and (for Replies) the parent's host. Peer Kowloon
    // servers apply the same set/replace/clear, an empty emoji clearing.
    const federation = getMultiFederationTargets(targetId, targetAuthorId, parentId);

    return { activity, created: result, result, federation };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
