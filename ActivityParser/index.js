import { ensureRegistry } from "./loader.js";
import normalize from "./normalize.js";

// --- tiny stubs you can wire to your DB layer ---
async function existsById(id, ctx) {
  return ctx.db?.activities?.exists ? ctx.db.activities.exists(id) : false;
}
async function getById(id, ctx) {
  return ctx.db?.activities?.get ? ctx.db.activities.get(id) : null;
}
async function persistCanonicalActivity(activity, ctx) {
  if (!ctx.db?.activities?.upsert) return activity;
  return ctx.db.activities.upsert(activity.id, activity);
}
// ------------------------------------------------

function resolveSubtype(activity) {
  // Trust the schema: objectType must be present when object exists
  return activity.objectType || null;
}

async function runHooks(hooksMod, phase, payload, ctx) {
  if (!hooksMod) return;
  const fn = hooksMod[phase];
  if (typeof fn !== "function") return;
  try {
    await fn(payload, ctx);
  } catch (e) {
    ctx?.logger?.warn?.(`[hooks:${phase}] ${e.message}`, {
      verb: payload?.activity?.type || payload?.result?.activity?.type,
    });
  }
}

async function verifySignature(requestMeta, federation) {
  // TODO: implement Cavage/HTTP Signatures verification for prod
  return true;
}

/**
 * Main entry -- parse + process an incoming Activity.
 * @param {object} rawActivity
 * @param {object} ctx { targetUserId?, requestMeta:{headers,rawBody,ip}, db, queues, federation, logger, domain, baseUrl }
 * @returns {Promise<{activity: object, createdObjects?: any[], sideEffects?: any[]}>}
 */
export default async function parseIncomingActivity(rawActivity, ctx) {
  if (!rawActivity || typeof rawActivity !== "object")
    throw new Error("Invalid activity payload");
  if (!rawActivity.type) throw new Error("Missing activity.type");

  await verifySignature(ctx.requestMeta, ctx.federation);

  // Normalize envelope
  const baseUrl = ctx.baseUrl || `https://${ctx.domain}`;
  const activity = await normalize(rawActivity, ctx);

  // Idempotency
  if (activity.id && (await existsById(activity.id, ctx))) {
    const existing = await getById(activity.id, ctx);
    return { activity: existing, sideEffects: ["dedupe:exists"] };
  }

  const registry = await ensureRegistry();
  const bucket = registry[activity.type];
  if (!bucket) throw new Error(`Unsupported activity.type: ${activity.type}`);

  const subtype = resolveSubtype(activity);
  const handler = (subtype && bucket.subtypes?.[subtype]) || bucket._default;

  if (!handler)
    throw new Error(
      `No handler for ${activity.type}${subtype ? `/${subtype}` : ""}`
    );

  try {
    // BEFORE hook
    await runHooks(bucket.hooks, "before", { activity }, ctx);

    // Handle
    const res = (await handler(activity, ctx)) || {};

    // Persist canonical Activity if handler didn't
    let stored = res.activity;
    if (!stored || !stored.id)
      stored = await persistCanonicalActivity(activity, ctx);

    // AFTER hook
    await runHooks(
      bucket.hooks,
      "after",
      { result: { ...res, activity: stored } },
      ctx
    );

    return { ...res, activity: stored };
  } catch (err) {
    await runHooks(bucket.hooks, "onError", { error: err, activity }, ctx);
    throw err;
  }
}

// Optional: for tests or hot-reload
export { ensureRegistry as initActivityParserRegistry };
