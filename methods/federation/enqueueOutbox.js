// /methods/federation/enqueueOutbox.js
// Enqueues an activity for outbound federation

import crypto from "crypto";
import Outbox from "#schema/Outbox.js";
import resolveAudience from "./resolveAudience.js";
import log from "#methods/utils/logger.js";

/**
 * Generate a unique idempotency key for a delivery
 * @param {string} activityId - The activity ID
 * @param {string} target - The target recipient
 * @returns {string}
 */
function generateIdempotencyKey(activityId, target) {
  const data = `${activityId}:${target}:${Date.now()}`;
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 32);
}

/**
 * Generate a dedupe hash to prevent duplicate fan-outs
 * @param {string} activityId - The activity ID
 * @param {Array<string>} audience - The resolved audience
 * @returns {string}
 */
function generateDedupeHash(activityId, audience) {
  const sorted = [...audience].sort();
  const data = `${activityId}:${sorted.join(",")}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Enqueue an activity for outbound federation
 * @param {Object} options
 * @param {Object} options.activity - The activity object to federate
 * @param {string} options.activityId - The saved local Activity ID
 * @param {string} options.actorId - The actor who created the activity
 * @param {string} [options.reason] - Why federate: true (for debugging)
 * @returns {Promise<Object>} The created outbox job
 */
export default async function enqueueOutbox({
  activity,
  activityId,
  actorId,
  reason = "activity.federate = true",
}) {
  if (!activity || !activityId || !actorId) {
    throw new Error(
      "enqueueOutbox requires activity, activityId, and actorId"
    );
  }

  const t0 = Date.now();

  // Resolve audience to concrete inbox URLs
  const resolved = await resolveAudience(activity);

  if (resolved.length === 0) {
    log.info("No remote recipients to federate to", {
      activityId,
      activityType: activity.type,
    });
    return {
      jobId: null,
      counts: { total: 0, pending: 0, delivered: 0, failed: 0, skipped: 0 },
      recipients: [],
    };
  }

  // Extract unique targets for dedupe hash
  const audienceTargets = resolved.map((r) => r.target);
  const dedupeHash = generateDedupeHash(activityId, audienceTargets);

  // Check for existing job (idempotent)
  const existing = await Outbox.findOne({ dedupeHash }).lean();
  if (existing) {
    log.info("Outbox job already exists (dedupe)", {
      jobId: existing.id,
      activityId,
      dedupeHash,
    });
    return {
      jobId: existing.id,
      counts: existing.counts,
      recipients: existing.deliveries.map((d) => ({
        target: d.target,
        host: d.host,
        status: d.status,
        inboxUrl: d.inboxUrl,
      })),
    };
  }

  // Create deliveries for each recipient
  const deliveries = resolved.map((recipient) => ({
    target: recipient.target,
    inboxUrl: recipient.inboxUrl,
    host: recipient.host,
    status: "pending",
    attempts: 0,
    nextAttemptAt: new Date(), // immediately available
    idempotencyKey: generateIdempotencyKey(activityId, recipient.target),
    metrics: { latencyMs: null, bytesSent: null, bytesReceived: null },
  }));

  // Create outbox job
  const job = await Outbox.create({
    activityId,
    activity,
    createdBy: actorId,
    audience: audienceTargets,
    status: "pending",
    counts: {
      total: deliveries.length,
      pending: deliveries.length,
      delivered: 0,
      failed: 0,
      skipped: 0,
    },
    reason,
    dedupeHash,
    ttl: new Date(Date.now() + 90 * 24 * 3600 * 1000), // 90 days TTL
    deliveries,
  });

  const elapsed = Date.now() - t0;

  log.info("Outbox job enqueued", {
    jobId: job.id,
    activityId,
    activityType: activity.type,
    recipients: deliveries.length,
    ms: elapsed,
  });

  return {
    jobId: job.id,
    counts: job.counts,
    recipients: deliveries.map((d) => ({
      target: d.target,
      host: d.host,
      status: d.status,
      inboxUrl: d.inboxUrl,
    })),
  };
}
