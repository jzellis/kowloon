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
  FeedItems,
} from "#schema";
import createNotification from "#methods/notifications/create.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import getMultiFederationTargets from "../utils/getMultiFederationTargets.js";

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
 * Determine federation targets for Reply activity.
 * Replies federate to the domain of the parent object if it's remote.
 */
export async function getFederationTargets(activity, created) {
  const targetId = activity.to; // parent post/page/etc ID
  if (!targetId) return { shouldFederate: false };

  const parsed = kowloonId(targetId);
  const { domain: serverDomain } = getServerSettings();

  if (!parsed.domain || parsed.domain.toLowerCase() === serverDomain?.toLowerCase()) {
    return { shouldFederate: false };
  }

  return {
    shouldFederate: true,
    scope: "domain",
    domains: [parsed.domain],
  };
}

// Window in which an identical reply from the same actor on the same target is
// treated as a duplicate (5 minutes).
const CONTENT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

export default async function Reply(activity, ctx = {}) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const actorId = activity.actorId;
    const targetId = activity.to;

    // 1b. Content-based dedup — same actor sending the same content to the same
    // target within the window is treated as a duplicate. Returns the existing
    // reply rather than creating a new one. Prevents spam-clicking the submit
    // button (client-side network-retry idempotency is handled separately via
    // `dedupeKey` in methods/activities/create.js).
    const submittedContent =
      activity.object?.source?.content ?? activity.object?.content;
    if (typeof submittedContent === "string" && submittedContent.trim()) {
      const since = new Date(Date.now() - CONTENT_DEDUPE_WINDOW_MS);
      const existing = await ReplyModel.findOne({
        actorId,
        target: targetId,
        "source.content": submittedContent,
        createdAt: { $gte: since },
      }).lean();
      if (existing) {
        activity.objectId = existing.id;
        return {
          activity,
          created: existing,
          duplicated: true,
          federation: { shouldFederate: false },
        };
      }
    }

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
      replyData.source.mediaType = "text/markdown";
    }

    if (activity.object.attachments) {
      replyData.attachments = activity.object.attachments;
    }

    // 3. Create the Reply
    const created = await ReplyModel.create(replyData);
    activity.objectId = created.id;

    // 4. Bump replyCount on the parent object and its FeedItems entry
    // Use raw collection driver to bypass all Mongoose middleware/hooks
    const collections = [
      Post?.collection,
      Page?.collection,
      Bookmark?.collection,
      Group?.collection,
      Circle?.collection,
    ];
    for (const col of collections) {
      try {
        if (!col) continue;
        const r = await col.updateOne({ id: targetId }, { $inc: { replyCount: 1 } });
        if (r?.modifiedCount > 0) break;
      } catch (e) {
        // ignore model mismatches
      }
    }
    // Keep FeedItems in sync so getPost returns the updated count immediately
    await FeedItems.updateOne({ id: targetId }, { $inc: { "object.replyCount": 1 } });

    // 5. Look up the parent object once for BOTH notification and federation.
    // Reply included so threaded replies (Reply targeting Reply) resolve their
    // author and grandparent for fan-out.
    let parentAuthorId;
    let grandparentId;
    for (const Model of [Post, Reply, Page, Bookmark, Group]) {
      try {
        if (!Model) continue;
        const parent = await Model.findOne({ id: targetId })
          .select("actorId target")
          .lean();
        if (parent?.actorId) {
          parentAuthorId = parent.actorId;
          grandparentId = parent.target;
          break;
        }
      } catch (e) {
        // Continue to next model
      }
    }

    // Create notification for the parent object's author
    try {
      if (parentAuthorId && parentAuthorId !== actorId) {
        const recipient = await User.findOne({ id: parentAuthorId })
          .select("prefs")
          .lean();
        const wantsNotification =
          recipient?.prefs?.notifications?.reply !== false;

        if (wantsNotification) {
          await createNotification({
            type: "reply",
            recipientId: parentAuthorId,
            actorId,
            objectId: targetId,
            objectType: "Post",
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

    // 6. Federation — parent host (canonical aggregate), parent author's home
    // (notification side-effect), and (for threaded replies) the grandparent
    // host (canonical view of the chain).
    const createdObj = created.toObject ? created.toObject() : created;
    const federation = getMultiFederationTargets(targetId, parentAuthorId, grandparentId);

    return {
      activity,
      created: createdObj,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
