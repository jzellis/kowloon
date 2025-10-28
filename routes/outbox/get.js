// /routes/outbox/get.js
// Get outbox job status (admin/debug)

import route from "../utils/route.js";
import Outbox from "#schema/Outbox.js";

export default route(async ({ req, set, setStatus }) => {
  const { id } = req.params;

  if (!id) {
    setStatus(400);
    set({ error: "Missing job ID" });
    return;
  }

  // Find the job
  const job = await Outbox.findOne({
    $or: [{ id }, { _id: id }],
  }).lean();

  if (!job) {
    setStatus(404);
    set({ error: "Job not found" });
    return;
  }

  // Return job details
  setStatus(200);
  set({
    jobId: job.id,
    activityId: job.activityId,
    status: job.status,
    counts: job.counts,
    reason: job.reason,
    createdAt: job.createdAt,
    lastAttemptedAt: job.lastAttemptedAt,
    deliveredAt: job.deliveredAt,
    deliveries: job.deliveries.map((d) => ({
      target: d.target,
      inboxUrl: d.inboxUrl,
      host: d.host,
      status: d.status,
      attempts: d.attempts,
      lastAttemptAt: d.lastAttemptAt,
      nextAttemptAt: d.nextAttemptAt,
      responseStatus: d.responseStatus,
      error: d.error,
      metrics: d.metrics,
    })),
  });
});
