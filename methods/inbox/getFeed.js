// #methods/inbox/getFeed.js
import { TimelineEntry } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { sanitizeAudience } from "#methods/visibility/helpers.js";

/**
 * Return the viewer's personalized feed from materialized TimelineEntry docs.
 *
 * TimelineEntry shape (assumed):
 *  - id, viewerId, objectType ("post"|"event"|...), objectId
 *  - actorId, to (copied from object at time of insert), createdAt, deletedAt
 *  - optionally a denormalized 'object' snapshot; if not present, your UI can refetch by id
 *
 * @param {string} viewerId     // required (must be the logged-in user)
 * @param {object} opts
 * @param {string|Date} [opts.before]        // cursor: createdAt < before
 * @param {number} [opts.limit=50]
 * @param {string[]} [opts.types]            // e.g., ["post","event"], default: all
 * @param {boolean} [opts.includeSelf=true]  // include items authored by viewer
 * @returns {Promise<{items:any[], count:number, nextCursor:string|null}>}
 */
export default async function getFeed(viewerId, opts = {}) {
  if (!viewerId) throw new Error("getFeed requires viewerId");

  const { before, limit = 50, types, includeSelf = true } = opts;

  // Base filter -- targeted timeline for this viewer
  const filter = { viewerId, deletedAt: null };

  if (before) filter.createdAt = { $lt: new Date(before) };
  if (types?.length)
    filter.objectType = { $in: types.map((t) => t.toLowerCase()) };
  if (!includeSelf) filter.actorId = { $ne: viewerId };

  const rows = await TimelineEntry.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    // Keep payload small; expand if you store snapshots
    .select("id objectType objectId actorId to createdAt object -_id")
    .lean();

  // Recompute per-request viewer context (blocks etc.) and mask audience
  const ctx = await getViewerContext(viewerId);

  const items = rows
    // optional: drop blocked authors in case entries predate a new block
    .filter(
      (r) => !ctx.blockedActorIds.has(r.actorId) || r.actorId === viewerId
    )
    // mask circle ids and attach canReply/canReact flags
    .map((r) => sanitizeAudience(r, ctx));

  const last = items[items.length - 1];
  const nextCursor = last?.createdAt
    ? new Date(last.createdAt).toISOString()
    : null;

  return { items, count: items.length, nextCursor };
}
