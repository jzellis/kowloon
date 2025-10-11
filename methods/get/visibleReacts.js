// #methods/get/visibleReacts.js
import { React } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import objectById from "#methods/get/objectById.js";
import { getTypeFromId } from "#methods/utils/assertTypeFromId.js";
import { sanitizeAudience } from "#methods/visibility/helpers.js";

export default async function getVisibleReacts(targetId, opts = {}) {
  const { viewerId = null, before, limit = 50, select } = opts;

  // 1) Parent must be visible to viewer (prevents leaking existence)
  const parentType = getTypeFromId(targetId).toLowerCase(); // e.g. "post", "event"
  const parent = await getVisibleById(parentType, targetId, {
    viewerId,
    select: "id actorId to createdAt",
  });
  if (!parent) return { items: [], count: 0, nextCursor: null };

  // 2) Build filter: reacts to target, not deleted, and not from blocked authors (except self)
  const ctx = await getViewerContext(viewerId);
  const filter = { target: targetId, deletedAt: null };
  if (ctx.blockedActorIds.size) {
    const blocked = [...ctx.blockedActorIds].filter((a) => a !== ctx.viewerId);
    if (blocked.length) filter.actorId = { $nin: blocked };
  }
  if (before) filter.createdAt = { $lt: new Date(before) };

  // 3) Projection
  const projection = buildProjection(select);

  // 4) Fetch + mask using the PARENT's audience (React has no 'to')
  const rows = await React.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .select(projection)
    .lean();

  const items = rows.map((r) =>
    sanitizeAudience({ ...r, to: parent.to, actorId: r.actorId }, ctx)
  );

  const last = items[items.length - 1];
  const nextCursor = last?.createdAt
    ? new Date(last.createdAt).toISOString()
    : null;

  return { items, count: items.length, nextCursor };
}

/* same projector used elsewhere */
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
