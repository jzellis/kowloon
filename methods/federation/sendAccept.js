// methods/federation/sendAccept.js
// Send Accept{Follow} to a remote actor's inbox after an inbound Follow.
//
// This is fire-and-forget: called after we add the remote actor to the local
// user's followers circle. Non-fatal if delivery fails (we'll still have the
// follower locally, and the remote side can retry).

import signHttpRequest from "./signHttpRequest.js";
import logger from "#methods/utils/logger.js";
import https from "https";

/**
 * Resolve the inbox URL for a remote actor.
 * Tries actor.inbox first, falls back to fetching the actor document.
 */
async function resolveInbox(actorId, knownInbox) {
  if (knownInbox) return knownInbox;

  if (!actorId?.startsWith("http")) return null;

  try {
    const agent = new https.Agent({ rejectUnauthorized: process.env.NODE_ENV === "production" });
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(actorId, {
      headers: { Accept: "application/activity+json, application/ld+json" },
      agent,
      timeout: 8000,
    });
    if (!res.ok) return null;
    const doc = await res.json();
    return doc?.inbox ?? null;
  } catch {
    return null;
  }
}

/**
 * Post an Accept{Follow} activity to the remote actor's inbox.
 *
 * @param {Object} options
 * @param {string} options.localActorUrl  - Our local actor's canonical URL (https://...)
 * @param {string} options.remoteActorId  - Remote actor who sent the Follow
 * @param {string} [options.remoteInbox]  - Remote actor's inbox URL (optional, will be fetched)
 * @param {string} options.followActivityId - The id of the incoming Follow activity
 */
export default async function sendAccept({ localActorUrl, remoteActorId, remoteInbox, followActivityId }) {
  try {
    const inboxUrl = await resolveInbox(remoteActorId, remoteInbox);
    if (!inboxUrl) {
      logger.warn("sendAccept: could not resolve remote inbox", { remoteActorId });
      return { ok: false, error: "inbox not found" };
    }

    const acceptBody = JSON.stringify({
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "Accept",
      actor: localActorUrl,
      object: followActivityId ?? {
        type: "Follow",
        actor: remoteActorId,
        object: localActorUrl,
      },
    });

    const { default: fetch } = await import("node-fetch");
    const { headers } = await signHttpRequest({
      method: "POST",
      url: inboxUrl,
      headers: { "Content-Type": "application/activity+json" },
      body: acceptBody,
    });

    const agent = new https.Agent({ rejectUnauthorized: process.env.NODE_ENV === "production" });
    const res = await fetch(inboxUrl, {
      method: "POST",
      headers,
      body: acceptBody,
      agent,
      timeout: 10000,
    });

    if (res.ok) {
      logger.info("sendAccept: delivered", { inboxUrl, status: res.status });
      return { ok: true };
    }

    const body = await res.text().catch(() => "");
    logger.warn("sendAccept: delivery failed", { inboxUrl, status: res.status, body });
    return { ok: false, status: res.status, body };
  } catch (err) {
    logger.warn("sendAccept: exception", { remoteActorId, error: err.message });
    return { ok: false, error: err.message };
  }
}
