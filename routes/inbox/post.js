// /routes/inbox/post.js
import route from "../utils/route.js";
import Kowloon from "#kowloon";
import Inbox from "#schema/Inbox.js";
import log from "#methods/utils/logger.js";

function safeHeaders(h = {}) {
  // Store only a safe/diagnostic subset
  const keep = [
    "date",
    "digest",
    "host",
    "signature",
    "user-agent",
    "content-type",
    "content-length",
    "accept",
    "accept-encoding",
    "x-forwarded-for",
  ];
  const out = {};
  for (const k of keep) {
    const v = h[k] ?? h[k.toLowerCase()];
    if (v !== undefined) out[k.toLowerCase()] = v;
  }
  return out;
}

export default route(async (api) => {
  const { req, body, setStatus, set } = api;

  // 1) Verify origin server (HTTP Signature)
  const sig = await Kowloon.federation.verifyHttpSignature(req);
  if (!sig.ok) {
    setStatus(401);
    set({ error: sig.error || "Invalid HTTP Signature" });
    return;
  }

  // 2) Optional: verify remote-user JWT if provided (proxied user actions)
  let remoteUser = null;
  const authz = req.get("Authorization");
  if (authz?.startsWith("Bearer ")) {
    const expectedAud = `${req.protocol}://${req.get("Host")}`;
    const dpop = req.get("DPoP"); // optional
    const vr = await Kowloon.auth.verifyRemoteUser({
      authz,
      dpop,
      expectedAud,
    });
    if (!vr.ok) {
      setStatus(401);
      set({ error: vr.error || "Remote user token invalid" });
      return;
    }
    remoteUser = vr.user; // { id, issuer, scope }
  }

  // 3) Normalize inbound activity (what we will pass to create())
  const activity = {
    ...body,
    federated: true,
    remoteId: body.id || body.remoteId,
    actorId: body.actorId || body.actor?.id || body.actor,
    _federation: { domain: sig.domain, keyId: sig.keyId, remoteUser },
  };

  // 4) Upsert Inbox envelope (idempotent on remoteId if present)
  const remoteId = activity.remoteId;
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress;

  let inbox;
  if (remoteId) {
    inbox = await Inbox.findOneAndUpdate(
      { remoteId },
      {
        $setOnInsert: {
          receivedAt: new Date(),
          body,
          headers: safeHeaders(req.headers || {}),
          ttl: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
        $set: {
          domain: sig.domain,
          keyId: sig.keyId,
          actorId: activity.actorId,
          type: activity.type,
          verified: true,
          status: { type: "accepted" },
          http: { ip, userAgent: req.get("User-Agent") },
        },
      },
      { new: true, upsert: true }
    );
  } else {
    // No remoteId provided → insert a fresh envelope (no idempotency possible)
    inbox = await Inbox.create({
      receivedAt: new Date(),
      body,
      headers: safeHeaders(req.headers || {}),
      ttl: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      domain: sig.domain,
      keyId: sig.keyId,
      actorId: activity.actorId,
      type: activity.type,
      verified: true,
      status: { type: "accepted" },
      http: { ip, userAgent: req.get("User-Agent") },
    });
  }

  // 5) Respond immediately and process asynchronously
  setStatus(202);
  set({ accepted: true });

  queueMicrotask(async () => {
    try {
      const t0 = Date.now();
      const created = await Kowloon.activities.create(activity);

      if (created?.error) {
        log.warn("INBOX create failed", {
          remoteId,
          domain: sig.domain,
          error: created.error,
        });
        await Inbox.updateOne(
          { _id: inbox._id },
          {
            $inc: { attempts: 1 },
            $set: {
              status: { type: "error", reason: "create_failed" },
              error: String(created.error),
            },
          }
        );
        return;
      }

      await Inbox.updateOne(
        { _id: inbox._id },
        {
          $set: {
            status: { type: "processed" },
            activityId: created.activity?.id,
            processedAt: new Date(),
          },
        }
      );

      log.info("INBOX processed", {
        remoteId,
        domain: sig.domain,
        type: activity.type,
        ms: Date.now() - t0,
      });
    } catch (err) {
      log.warn("INBOX handler exception", {
        remoteId,
        domain: sig.domain,
        error: err?.message || String(err),
      });
      await Inbox.updateOne(
        { _id: inbox._id },
        {
          $inc: { attempts: 1 },
          $set: {
            status: { type: "error", reason: "exception" },
            error: String(err?.message || err),
          },
        }
      );
    }
  });
});
