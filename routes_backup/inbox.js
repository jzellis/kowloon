// /routes/inbox.js
// POST /inbox
// Server inbox for receiving federated activities from remote servers

import route from "./utils/route.js";
import Kowloon from "#kowloon";
import logger from "#methods/utils/logger.js";

export default route(
  async (api) => {
    const { req, setStatus, set } = api;

    // 1. Verify HTTP Signature (server-to-server authentication)
    const sig = await Kowloon.federation.verifyHttpSignature(req);
    if (!sig.ok) {
      logger.warn("inbox: HTTP Signature verification failed", {
        error: sig.error,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      setStatus(401);
      set({ error: sig.error || "Invalid HTTP Signature" });
      return;
    }

    const remoteDomain = sig.domain;
    const actorId = sig.actorId; // Extracted from keyId

    logger.info("inbox: Received activity", {
      remoteDomain,
      actorId,
      activityType: req.body?.type,
      activityId: req.body?.id,
    });

    // 2. Validate activity payload
    if (!req.body || typeof req.body !== "object") {
      logger.warn("inbox: Invalid payload (not an object)", {
        remoteDomain,
      });
      setStatus(400);
      set({ error: "Invalid activity payload" });
      return;
    }

    const activity = req.body;

    if (!activity.type || typeof activity.type !== "string") {
      logger.warn("inbox: Missing or invalid activity type", {
        remoteDomain,
        activity,
      });
      setStatus(400);
      set({ error: "Missing or invalid activity.type" });
      return;
    }

    // 3. Extract idempotency key (prevent duplicate processing)
    const idempotencyKey =
      req.get("idempotency-key") ||
      activity.id ||
      `${activity.type}:${actorId}:${Date.now()}`;

    // 4. Check for duplicate (idempotent processing)
    // TODO: Implement idempotency check using Redis or database
    // For now, we rely on Activity schema's unique constraint on 'id'

    // 5. Process activity through ActivityParser
    try {
      const { default: ActivityParser } = await import("#ActivityParser");

      // Ensure activity has required fields
      if (!activity.actor) {
        activity.actor = { id: actorId };
      }

      // Mark as remote origin for tracking
      activity._origin = "remote";
      activity._originDomain = remoteDomain;

      const result = await ActivityParser(activity);

      if (result.error) {
        logger.warn("inbox: ActivityParser error", {
          remoteDomain,
          activityType: activity.type,
          activityId: activity.id,
          error: result.error,
        });
        setStatus(400);
        set({ error: result.error });
        return;
      }

      logger.info("inbox: Activity processed successfully", {
        remoteDomain,
        activityType: activity.type,
        activityId: activity.id,
        objectId: result.activity?.objectId,
      });

      // 6. Return success with Location header if object was created
      setStatus(202); // Accepted (async processing)
      if (result.activity?.objectId) {
        const objectUrl = `https://${req.get("host")}/${result.activity.objectId}`;
        set({
          id: result.activity.objectId,
          url: objectUrl,
          status: "accepted",
        });
        api.res.set("Location", objectUrl);
      } else {
        set({ status: "accepted" });
      }
    } catch (err) {
      logger.error("inbox: Processing error", {
        remoteDomain,
        activityType: activity.type,
        activityId: activity.id,
        error: err.message,
        stack: err.stack,
      });
      setStatus(500);
      set({ error: "Internal server error" });
    }
  },
  { allowUnauth: true } // Authentication is via HTTP Signature, not JWT
);
