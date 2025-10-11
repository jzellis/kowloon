// #methods/get/visibleInteractions.js
import { Reply, React } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import objectById from "#methods/get/objectById.js";
import { getTypeFromId } from "#methods/utils/assertTypeFromId.js";
import { sanitizeAudience } from "#methods/visibility/helpers.js";

const MODEL = { reply: Reply, react: React };

export default async function getVisibleInteractions(
  kind,
  targetId,
  opts = {}
) {
  const { viewerId = null, before, limit = 50, select } = opts;
  const parentType = getTypeFromId(targetId).toLowerCase();
  const parent = await getVisibleById(parentType, targetId, {
    viewerId,
    select: "id actorId to createdAt",
  });
  if (!parent) return { items: [], count: 0, nextCursor: null };

  const ctx = await getViewerContext(viewerId);

  const filter = { target: targetId, deletedAt: null };
  if (ctx.blockedActorIds.size) {
    const blocked = [...ctx.blockedActorIds].filter((a) => a !== ctx.viewerId);
    if (blocked.length) filter.actorId = { $nin: blocked };
  }
  if (before) filter.createdAt = { $lt: new Date(before) };

  const projection = buildProjection(select);
  const Model = MODEL[kind];

  const rows = await Model.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .select(projection)
    .lean();
  const items = rows.map((r) =>
    sanitizeAudience({ ...r, to: parent.to, actorId: r.actorId }, ctx)
  );

  const last = items[items.length - 1];
  return {
    items,
    count: items.length,
    nextCursor: last?.createdAt ? new Date(last.createdAt).toISOString() : null,
  };
}

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
