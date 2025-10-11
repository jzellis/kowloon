// #methods/get/visibleReplies.js
import { Reply } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import { buildVisibilityQuery } from "#methods/visibility/filter.js";
import { sanitizeAudience } from "#methods/visibility/helpers.js";
import objectById from "#methods/get/objectById.js";
import { getTypeFromId } from "#methods/utils/assertTypeFromId.js";

/**
 * Return replies for a target object id, only if the viewer can see the parent.
 * Reply docs inherit visibility from the parent (Reply has no own `to`).
 *
 * @param {string} targetId
 * @param {object} opts
 * @param {string|null} opts.viewerId
 * @param {string|Date} [opts.before]
 * @param {number} [opts.limit=50]
 * @param {string|string[]} [opts.select]  // projection for replies
 */
export default async function getVisibleReplies(targetId, opts = {}) {
  const { viewerId = null, before, limit = 50, select } = opts;

  // Ensure the viewer can see the parent first
  const parentType = getTypeFromId(targetId).toLowerCase(); // "post", "event", ...
  const parent = await getVisibleById(parentType, targetId, {
    viewerId,
    // We need at least id/actorId/to/createdAt to drive visibility + masking
    select: "id actorId to createdAt",
  });
  if (!parent) {
    return { items: [], count: 0, nextCursor: null };
  }

  const ctx = await getViewerContext(viewerId);

  // Base filter: replies targeting this object (not deleted)
  const filter = { target: targetId, deletedAt: null };

  // Exclude authors the viewer blocked (never exclude self)
  if (ctx.blockedActorIds.size) {
    const blocked = [...ctx.blockedActorIds].filter((a) => a !== ctx.viewerId);
    if (blocked.length) filter.actorId = { $nin: blocked };
  }

  // Cursor
  if (before) filter.createdAt = { $lt: new Date(before) };

  // Projection (drop _id/__v; allow inclusion or exclusion)
  const projection = buildProjection(select);

  const rows = await Reply.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .select(projection)
    .lean();

  // Since Reply has no own `to`, sanitize using the parent's addressing
  const items = rows.map((r) =>
    sanitizeAudience({ ...r, to: parent.to, actorId: r.actorId }, ctx)
  );

  const last = items[items.length - 1];
  const nextCursor = last?.createdAt
    ? new Date(last.createdAt).toISOString()
    : null;

  return { items, count: items.length, nextCursor };
}

/* shared with getVisibleCollection -- paste locally if not globally available */
function buildProjection(select) {
  if (!select) return "-_id -__v";
  const sel = Array.isArray(select)
    ? select.join(" ")
    : String(select).replace(/,/g, " ").trim();
  if (!sel) return "-_id -__v";
  const tokens = sel.split(/\s+/);
  const isInclusion = tokens.every((t) => !t.startsWith("-"));
  return isInclusion ? `${sel} -_id` : `-__v -_id ${sel}`;
}
