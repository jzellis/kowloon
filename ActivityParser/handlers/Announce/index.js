// /ActivityParser/handlers/Announce/index.js
// Handle incoming Announce (boost/share) activities from remote servers.
//
// An Announce is a remote actor resharing one of our posts or a third-party post.
// We store it in FeedItems so it appears in timelines for users who follow the
// announcer, and update shareCount on the original post if it's local.

import { FeedItems, Post } from "#schema";
import logger from "#methods/utils/logger.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import { getSetting } from "#methods/settings/cache.js";

export function validate(activity) {
  if (!activity?.actorId) {
    return { valid: false, errors: ["Announce: missing actorId"] };
  }
  if (!activity?.object) {
    return { valid: false, errors: ["Announce: missing object (URL of post being boosted)"] };
  }
  return { valid: true };
}

export default async function Announce(activity) {
  try {
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    const announcedObjectId = typeof activity.object === "string"
      ? activity.object
      : activity.object?.id;

    if (!announcedObjectId) {
      return { activity, error: "Announce: could not determine object ID" };
    }

    const domain = getSetting("domain");

    // Increment shareCount on the original post if it's local
    let isLocal = false;
    try {
      const url = new URL(announcedObjectId);
      isLocal = isLocalDomain(url.hostname);
    } catch {
      isLocal = String(announcedObjectId).includes(`@${domain}`);
    }

    if (isLocal) {
      // Look up by actorId URL or our internal ID
      const post = await Post.findOne({
        $or: [{ actorId: announcedObjectId }, { id: announcedObjectId }],
        deletedAt: null,
      }).lean();

      if (post) {
        await Post.updateOne({ _id: post._id }, { $inc: { shareCount: 1 } });
        await FeedItems.updateOne({ id: post.id }, { $inc: { "object.shareCount": 1 } });
        logger.info("Announce: incremented shareCount", { postId: post.id, actorId: activity.actorId });
      }
    }

    // Store the Announce itself in FeedItems so followers see boosts in their timeline
    // The FeedItems entry represents "actorId boosted <announcedObjectId>"
    const announceId = activity.remoteId ?? `announce:${activity.actorId}:${Date.now()}`;
    await FeedItems.findOneAndUpdate(
      { id: announceId },
      {
        $set: {
          id: announceId,
          actorId: activity.actorId,
          objectType: "Announce",
          type: "Announce",
          to: activity.to ?? "public",
          canReply: "public",
          canReact: "public",
          origin: "remote",
          publishedAt: activity.publishedAt ?? new Date(),
          object: {
            id: announceId,
            type: "Announce",
            actorId: activity.actorId,
            announcedObjectId,
          },
        },
      },
      { upsert: true }
    );

    return {
      activity,
      result: { status: "announced", announcedObjectId },
      federation: { shouldFederate: false },
    };
  } catch (err) {
    return { activity, error: `Announce: ${err.message}` };
  }
}
