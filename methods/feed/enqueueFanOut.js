// /methods/feed/enqueueFanOut.js
// Enqueues a FeedItems entry for asynchronous fan-out to Feed collection
// Follows the pattern established by methods/federation/enqueueOutbox.js

import crypto from "crypto";
import { FeedFanOut } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Generate a dedupe hash to prevent duplicate fan-out jobs
 * @param {string} feedCacheId - The FeedItems ID
 * @returns {string}
 */
function generateDedupeHash(feedCacheId) {
  return crypto.createHash("sha256").update(feedCacheId).digest("hex");
}

/**
 * Extract LOCAL circle/group IDs from audience strings
 * @param {string} to - Audience "to" field
 * @param {string} canReply - Audience "canReply" field
 * @param {string} canReact - Audience "canReact" field
 * @returns {string[]} Array of LOCAL addressed IDs
 */
function extractAddressedIds(to, canReply, canReact) {
  const { domain } = getServerSettings();
  const localDomain = domain?.toLowerCase();

  const allTokens = [to, canReply, canReact]
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);

  const ids = allTokens.filter(
    (token) =>
      token.startsWith("circle:") ||
      token.startsWith("group:")
  );

  // Filter to LOCAL IDs only (same domain)
  const localIds = ids.filter((id) => {
    const [, domainPart] = id.split("@");
    return domainPart?.toLowerCase() === localDomain;
  });

  // Deduplicate
  return [...new Set(localIds)];
}

/**
 * Enqueue a feed fan-out job for a FeedItems entry
 * @param {Object} options
 * @param {string} options.feedCacheId - The FeedItems.id to fan out
 * @param {string} options.objectType - The object type (Post/Reply/Page/etc)
 * @param {string} options.actorId - The author/creator
 * @param {Object} options.audience - Audience snapshot { to, canReply, canReact }
 * @returns {Promise<Object>} The created fan-out job
 */
export default async function enqueueFeedFanOut({
  feedCacheId,
  objectType,
  actorId,
  audience = {},
}) {
  if (!feedCacheId || !objectType || !actorId) {
    throw new Error(
      "enqueueFeedFanOut requires feedCacheId, objectType, and actorId"
    );
  }

  const dedupeHash = generateDedupeHash(feedCacheId);

  // Check for existing job (idempotent)
  const existing = await FeedFanOut.findOne({ dedupeHash }).lean();
  if (existing) {
    const existingId = existing.id || existing._id?.toString();
    console.log(`Feed fan-out job already exists for ${feedCacheId}`, {
      jobId: existingId,
      status: existing.status,
    });
    return {
      jobId: existingId,
      status: existing.status,
      counts: existing.counts,
      duplicate: true,
    };
  }

  // Extract LOCAL addressed IDs
  const addressedIds = extractAddressedIds(
    audience.to,
    audience.canReply,
    audience.canReact
  );

  // Create fan-out job
  const job = await FeedFanOut.create({
    feedCacheId,
    objectType,
    actorId,
    status: "pending",
    audience: {
      to: audience.to || "public",
      canReply: audience.canReply || "public",
      canReact: audience.canReact || "public",
      addressedIds, // LOCAL circle/group IDs only
    },
    dedupeHash,
    attempts: 0,
    nextAttemptAt: new Date(), // immediately available
  });

  const jobId = job.id || job._id?.toString();
  console.log(`Feed fan-out job enqueued for ${feedCacheId}`, {
    jobId,
    objectType,
    actorId,
  });

  return {
    jobId,
    status: "pending",
    counts: job.counts,
    duplicate: false,
  };
}
