// /methods/federation/outboxWorker.js
// Worker to process outbox deliveries with retries and exponential backoff

import Outbox from "#schema/Outbox.js";
import signHttpRequest from "./signHttpRequest.js";
import log from "#methods/utils/logger.js";

// Configuration
const CONFIG = {
  batchSize: 10, // Process N deliveries per tick
  maxAttempts: 5, // Max retry attempts per delivery
  baseDelayMs: 1000, // Base delay for exponential backoff (1s)
  maxDelayMs: 3600000, // Max delay cap (1 hour)
  hostConcurrency: 2, // Max concurrent deliveries per host
  globalConcurrency: 10, // Max total concurrent deliveries
  responseBodyMaxBytes: 1024, // Max response body to store
};

/**
 * Calculate next attempt time using exponential backoff
 * @param {number} attempts - Number of previous attempts
 * @returns {Date} Next attempt time
 */
function calculateNextAttempt(attempts) {
  const delayMs = Math.min(
    CONFIG.baseDelayMs * Math.pow(2, attempts),
    CONFIG.maxDelayMs
  );
  return new Date(Date.now() + delayMs);
}

/**
 * Truncate response body to max size
 * @param {string} body - Response body
 * @returns {string} Truncated body
 */
function truncateBody(body) {
  if (!body || typeof body !== "string") return "";
  if (body.length <= CONFIG.responseBodyMaxBytes) return body;
  return body.slice(0, CONFIG.responseBodyMaxBytes) + "... [truncated]";
}

/**
 * Send activity to remote inbox
 * @param {Object} delivery - The delivery to process
 * @param {Object} activity - The activity to send
 * @returns {Promise<Object>} Result of the delivery attempt
 */
async function sendToInbox(delivery, activity) {
  const t0 = Date.now();

  try {
    // Prepare body
    const body = JSON.stringify(activity);
    const bytesSent = Buffer.byteLength(body, "utf8");

    // Sign request
    const { headers } = await signHttpRequest({
      method: "POST",
      url: delivery.inboxUrl,
      headers: {
        "Content-Type": "application/activity+json",
        "Idempotency-Key": delivery.idempotencyKey,
      },
      body,
    });

    // Send request
    const response = await fetch(delivery.inboxUrl, {
      method: "POST",
      headers,
      body,
      timeout: 10000, // 10s timeout
    });

    const latencyMs = Date.now() - t0;
    const responseBody = await response.text();
    const bytesReceived = Buffer.byteLength(responseBody, "utf8");

    // Extract Location header (remote activity ID)
    const location = response.headers.get("location");

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: truncateBody(responseBody),
      location,
      metrics: { latencyMs, bytesSent, bytesReceived },
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;

    return {
      ok: false,
      status: null,
      error: {
        message: err.message,
        code: err.code || "UNKNOWN",
        class: err.constructor.name,
      },
      metrics: { latencyMs, bytesSent: 0, bytesReceived: 0 },
    };
  }
}

/**
 * Process a single delivery
 * @param {Object} job - The outbox job
 * @param {Object} delivery - The delivery to process
 * @returns {Promise<Object>} Updated delivery
 */
async function processDelivery(job, delivery) {
  // Mark as delivering
  delivery.status = "delivering";
  delivery.attempts += 1;
  delivery.lastAttemptAt = new Date();

  // Send to inbox
  const result = await sendToInbox(delivery, job.activity);

  // Update metrics
  delivery.metrics = result.metrics;

  // Handle response
  if (result.ok) {
    // Success: 2xx response
    delivery.status = "delivered";
    delivery.responseStatus = result.status;
    delivery.responseHeaders = result.headers;
    delivery.responseBody = result.body;
    delivery.remoteActivityId = result.location || null;
    delivery.error = null;
    delivery.nextAttemptAt = null;

    log.info("Delivery succeeded", {
      jobId: job.id,
      target: delivery.target,
      host: delivery.host,
      status: result.status,
      attempts: delivery.attempts,
      latencyMs: result.metrics.latencyMs,
    });
  } else if (result.status === 410 || result.status === 404) {
    // 410 Gone or 404 Not Found: permanent failure (actor/inbox doesn't exist)
    delivery.status = "skipped";
    delivery.responseStatus = result.status;
    delivery.responseHeaders = result.headers;
    delivery.responseBody = result.body;
    delivery.error = {
      message: `Actor or inbox not found (${result.status})`,
      code: "NOT_FOUND",
      class: "PermanentFailure",
    };
    delivery.nextAttemptAt = null;

    log.warn("Delivery skipped (not found)", {
      jobId: job.id,
      target: delivery.target,
      host: delivery.host,
      status: result.status,
    });
  } else if (result.status >= 400 && result.status < 500) {
    // 4xx client error: permanent failure after a few quick retries
    if (delivery.attempts >= 2) {
      delivery.status = "failed";
      delivery.nextAttemptAt = null;
    } else {
      // Quick retry for auth/clock skew issues
      delivery.status = "pending";
      delivery.nextAttemptAt = new Date(Date.now() + 5000); // 5s
    }

    delivery.responseStatus = result.status;
    delivery.responseHeaders = result.headers;
    delivery.responseBody = result.body;
    delivery.error = {
      message: `Client error: ${result.statusText || result.status}`,
      code: "CLIENT_ERROR",
      class: "ClientError",
    };

    log.warn("Delivery failed (client error)", {
      jobId: job.id,
      target: delivery.target,
      host: delivery.host,
      status: result.status,
      attempts: delivery.attempts,
    });
  } else if (result.status >= 500 || result.error) {
    // 5xx server error or network error: retry with exponential backoff
    if (delivery.attempts >= CONFIG.maxAttempts) {
      delivery.status = "failed";
      delivery.nextAttemptAt = null;
    } else {
      delivery.status = "pending";
      delivery.nextAttemptAt = calculateNextAttempt(delivery.attempts);
    }

    delivery.responseStatus = result.status;
    delivery.responseHeaders = result.headers;
    delivery.responseBody = result.body;
    delivery.error = result.error || {
      message: `Server error: ${result.statusText || result.status}`,
      code: "SERVER_ERROR",
      class: "ServerError",
    };

    log.warn("Delivery failed (will retry)", {
      jobId: job.id,
      target: delivery.target,
      host: delivery.host,
      status: result.status,
      attempts: delivery.attempts,
      nextAttemptAt: delivery.nextAttemptAt,
      error: delivery.error.message,
    });
  }

  return delivery;
}

/**
 * Find and process due deliveries
 * @returns {Promise<number>} Number of deliveries processed
 */
export async function processOutboxBatch() {
  const now = new Date();

  // Find jobs with pending/failed deliveries that are due
  const jobs = await Outbox.find({
    status: { $in: ["pending", "delivering", "partial"] },
    "counts.pending": { $gt: 0 },
  })
    .limit(CONFIG.batchSize)
    .lean();

  if (jobs.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const job of jobs) {
    // Find deliveries that are due
    const dueDeliveries = job.deliveries.filter((d) => {
      if (d.status !== "pending") return false;
      if (!d.nextAttemptAt) return true; // No next attempt = immediately available
      return new Date(d.nextAttemptAt) <= now;
    });

    if (dueDeliveries.length === 0) continue;

    // Process each delivery (TODO: respect host concurrency limits)
    for (const delivery of dueDeliveries) {
      try {
        // Find the actual job document (not lean)
        const jobDoc = await Outbox.findById(job._id);
        if (!jobDoc) continue;

        // Find the delivery subdocument
        const deliveryDoc = jobDoc.deliveries.id(delivery._id);
        if (!deliveryDoc) continue;

        // Process it
        const updatedDelivery = await processDelivery(jobDoc, deliveryDoc);

        // Update the delivery in the document
        Object.assign(deliveryDoc, updatedDelivery);

        // Update job lastAttemptedAt
        jobDoc.lastAttemptedAt = new Date();

        // Save (pre-save hook will recalculate status and counts)
        await jobDoc.save();

        processed++;
      } catch (err) {
        log.error("Error processing delivery", {
          jobId: job.id,
          deliveryId: delivery._id,
          error: err.message,
          stack: err.stack,
        });
      }
    }
  }

  if (processed > 0) {
    log.info("Outbox batch processed", {
      jobsChecked: jobs.length,
      deliveriesProcessed: processed,
    });
  }

  return processed;
}

/**
 * Start the outbox worker (polls for due work)
 * @param {number} intervalMs - Polling interval in milliseconds
 * @returns {NodeJS.Timeout} The interval handle
 */
export function startOutboxWorker(intervalMs = 5000) {
  log.info("Starting outbox worker", { intervalMs });

  const handle = setInterval(async () => {
    try {
      await processOutboxBatch();
    } catch (err) {
      log.error("Outbox worker error", {
        error: err.message,
        stack: err.stack,
      });
    }
  }, intervalMs);

  // Process immediately on start
  processOutboxBatch().catch((err) => {
    log.error("Initial outbox worker error", {
      error: err.message,
    });
  });

  return handle;
}

export default {
  processOutboxBatch,
  startOutboxWorker,
};
