// /methods/createActivity.js
// Centralized Activity creation for ALL callers (outbox + inbox).
// - Validates with ActivityParser/validate
// - Dispatches to verb handler
// - Applies idempotency (remoteId / dedupeKey) when present
// - Persists Activity with new schema fields (objectId, sideEffects, federated flag, etc.)
// - Strips transient _federation before saving

import { Activity } from "#schema";
import ActivityParser from "#ActivityParser";
import validateActivity from "#ActivityParser/validate.js";
import ObjectById from "#methods/get/objectById.js";
import toMember from "#methods/parse/toMember.js";
import kowloonId from "#methods/parse/kowloonId.js";
import shouldFederate from "#methods/federation/shouldFederate.js";

export default async function createActivity(input) {
  try {
    // Shallow clone to avoid mutating caller payload
    const activity = { ...input };

    // ---- Basic guards ------------------------------------------------------
    if (!activity?.type || typeof activity.type !== "string") {
      return { error: "Activity: missing or invalid 'type'" };
    }
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { error: "Activity: missing or invalid 'actorId'" };
    }

    // ---- Idempotency (federation + local) ---------------------------------
    // 1) For federated inbound, prefer remoteId-based dedupe.
    if (activity.remoteId && typeof activity.remoteId === "string") {
      const existing = await Activity.findOne({
        remoteId: activity.remoteId,
      }).lean();
      if (existing) {
        return { activity: existing, duplicated: true, federated: true };
      }
    }
    // 2) Optional local idempotency via a caller-provided dedupeKey.
    if (activity.dedupeKey && typeof activity.dedupeKey === "string") {
      const existing = await Activity.findOne({
        dedupeKey: activity.dedupeKey,
      }).lean();
      if (existing) {
        return { activity: existing, duplicated: true };
      }
    }

    // ---- Validate with the dynamic verbs validator ------------------------
    const v = await validateActivity(activity);
    if (!v.valid) {
      return { activity, error: `Validation failed: ${v.message}` };
    }

    // Gets the activity User and sets it on the activity if not already set
    if (!activity.actor && kowloonId(activity.actorId).type === "User") {
      let actor = (await ObjectById(activity.actorId)).object;

      activity.actor = toMember(actor);
    }

    // ---- Should the Activity federate?

    activity.federated = activity.federated || shouldFederate(activity);

    // ---- Dispatch to the verb handler -------------------------------------
    const parser = await ActivityParser();
    const handler = parser[activity.type];
    if (typeof handler !== "function") {
      return { error: `Unsupported activity type: ${activity.type}` };
    }

    const result = await handler(activity);
    if (result?.error) {
      // Verb reported an error → do not persist an Activity record
      return { error: result.error, result };
    }

    // ---- Persist the Activity (annotate with handler effects) --------------
    const toSave = {
      ...activity,
      objectId: result?.activity?.objectId,

      // If the handler signals federation is needed, mark here so
      // the caller (e.g., /outbox) can enqueue; you can flip this to true AFTER
      // successful fan-out if you want it to mean "already federated".
      federated: Boolean(result?.federate || activity.federated),

      // Keep idempotency hints if provided:
      remoteId: activity.remoteId,
      remoteRecipients: activity.remoteRecipients,
      dedupeKey: activity.dedupeKey,
    };

    // 🚫 Do NOT persist transient federation meta
    // (e.g., { domain, keyId, remoteUser } added by /inbox route)
    const { _federation, ...persistable } = toSave;

    const createdActivity = await Activity.create(persistable);

    // Return both the saved Activity and the verb's payload
    return {
      activity: createdActivity,
      result,
      federate: Boolean(result?.federate), // convenience flag for /outbox caller
    };
  } catch (err) {
    console.error(err);
    return { error: err?.message || String(err) };
  }
}
