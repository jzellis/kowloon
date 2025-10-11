// #methods/get/visibleBookmarks.js
import { Bookmark } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";
import objectById from "#methods/get/objectById.js";
import { getTypeFromId, isUserId } from "#methods/utils/assertTypeFromId.js";

function sameDomain(a, b) {
  if (!a || !b) return false;
  const da = a.split("@").pop();
  const db = b.split("@").pop();
  return !!da && !!db && da === db;
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

/**
 * List bookmarks for an owner, filtering by bookmark record visibility
 * AND by target visibility for the viewer.
 *
 * @param {"user"|"group"|"server"} ownerType
 * @param {string} ownerId                    // "@user@domain" | "group:uuid@domain" | "@server@domain"
 * @param {object} opts
 * @param {string|null} opts.viewerId
 * @param {string|Date} [opts.before]
 * @param {number} [opts.limit=50]
 * @param {string|string[]} [opts.select]     // projection for bookmark records
 * @returns {Promise<{items:any[], count:number, nextCursor:string|null}>}
 */
export default async function getVisibleBookmarks(
  ownerType,
  ownerId,
  opts = {}
) {
  const { viewerId = null, before, limit = 50, select } = opts;

  const ctx = await getViewerContext(viewerId);

  // 1) Build bookmark-record visibility filter
  const base = { ownerType, ownerId, deletedAt: null };
  let toFilter;

  const isOwner = viewerId && viewerId === ownerId;

  if (isOwner) {
    // Owner sees all their bookmarks (both @public and @server)
    toFilter = { $in: ["@public", "@server"] };
  } else if (!viewerId) {
    // Anonymous: only @public
    toFilter = "@public";
  } else {
    // Logged-in:
    // - Always @public
    // - Include @server if viewer shares the domain with the owner (for server or user),
    //   or (for groups) also require same domain (you can tighten to membership later if desired).
    const allowServer =
      ownerType === "server"
        ? sameDomain(viewerId, ownerId)
        : ownerType === "user"
        ? sameDomain(viewerId, ownerId)
        : ownerType === "group"
        ? sameDomain(viewerId, ownerId)
        : false;

    toFilter = allowServer ? { $in: ["@public", "@server"] } : "@public";
  }

  const filter = { ...base, to: toFilter };
  if (before) filter.createdAt = { $lt: new Date(before) };

  // 2) Fetch a page of bookmark records
  const projection = buildProjection(
    select ||
      "id type ownerId ownerType target href to title image tags summary createdAt"
  );

  const rows = await Bookmark.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .select(projection)
    .lean();

  // 3) Resolve targets through visibility (drop those you can't see)
  const items = [];
  for (const b of rows) {
    let targetObject = null;

    if (b.target) {
      try {
        const targetType = getTypeFromId(b.target).toLowerCase();
        targetObject = await getVisibleById(targetType, b.target, { viewerId });
      } catch {
        // if target id is malformed, skip
        targetObject = null;
      }
    }

    // If there's a target id but it's not visible to the viewer, skip the bookmark
    if (b.target && !targetObject) continue;

    // Compose final row; include resolved target if present
    items.push({
      ...b,
      ...(targetObject ? { targetObject } : {}),
    });
  }

  const last = items[items.length - 1];
  const nextCursor = last?.createdAt
    ? new Date(last.createdAt).toISOString()
    : null;

  return { items, count: items.length, nextCursor };
}
