// #ActivityParser/handlers/Reply/index.js
// Reply is its own model, NOT a Post subtype. This handler is self-contained:
// validates, creates the Reply doc, bumps replyCount on parent, federates if
// remote, and creates a notification for the parent author.

import {
  Reply as ReplyModel,
  Post,
  Page,
  Bookmark,
  Group,
  Circle,
  User,
} from "#schema";
import getFederationTargetsHelper from "../utils/getFederationTargets.js";
import createNotification from "#methods/notifications/create.js";

/**
 * Validate Reply activity
 * Required: actorId, objectType ("Reply"), object (with content), to (parent ID)
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Reply: missing activity.actorId");
  }

  if (!activity?.objectType || activity.objectType !== "Reply") {
    errors.push("Reply: objectType must be 'Reply'");
  }

  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("Reply: missing required field 'object'");
  }

  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("Reply: missing required field 'to' (parent object ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Reply activity
 */
export async function getFederationTargets(activity, created) {
  return getFederationTargetsHelper(activity, created);
}

export default async function Reply(activity, ctx = {}) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetId = activity.to;

    // 2. Build the Reply document
    const replyData = {
      actorId,
      actor: activity.actor || {},
      target: targetId,
      to: "",
      canReply: "",
      canReact: "",
      source: {},
    };

    // Content: accept object.content or object.source.content
    if (activity.object.source?.content) {
      replyData.source = { ...activity.object.source };
    } else if (activity.object.content) {
      replyData.source.content = activity.object.content;
    }

    if (!replyData.source.mediaType) {
      replyData.source.mediaType = "text/html";
    }

    if (activity.object.attachments) {
      replyData.attachments = activity.object.attachments;
    }

    // 3. Create the Reply
    const created = await ReplyModel.create(replyData);
    activity.objectId = created.id;

    // 4. Bump replyCount on the parent object
    const inc = { $inc: { replyCount: 1 } };
    const models = [Post, Page, Bookmark, Group, Circle];
    for (const Model of models) {
      try {
        if (!Model) continue;
        const r = await Model.updateOne({ id: targetId }, inc);
        if (r && r.modifiedCount > 0) break;
      } catch (e) {
        // ignore model mismatches
      }
    }

    // 5. Create notification for the parent object's author
    try {
      let targetAuthorId;
      for (const Model of [Post, Page, Bookmark, Group]) {
        try {
          if (!Model) continue;
          const target = await Model.findOne({ id: targetId })
            .select("actorId")
            .lean();
          if (target?.actorId) {
            targetAuthorId = target.actorId;
            break;
          }
        } catch (e) {
          // Continue to next model
        }
      }

      if (targetAuthorId && targetAuthorId !== actorId) {
        const recipient = await User.findOne({ id: targetAuthorId })
          .select("prefs")
          .lean();
        const wantsNotification =
          recipient?.prefs?.notifications?.reply !== false;

        if (wantsNotification) {
          await createNotification({
            type: "reply",
            recipientId: targetAuthorId,
            actorId,
            objectId: created.id,
            objectType: "Reply",
            activityId: activity.id,
            activityType: "Reply",
            groupKey: `reply:${targetId}`,
          });
        }
      }
    } catch (err) {
      console.error("Failed to create notification for Reply:", err.message);
      // Non-fatal
    }

    // 6. Federation
    const createdObj = created.toObject ? created.toObject() : created;
    const federation = await getFederationTargets(activity, createdObj);

    return {
      activity,
      created: createdObj,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
