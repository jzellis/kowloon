// #methods/get/visibleCollection.js
import {
  Activity,
  Bookmark,
  Circle,
  Event,
  File,
  Flag,
  Group,
  Page,
  Post,
  React,
  Reply,
  User,
  Invite,
} from "#schema";

import { getViewerContext } from "#methods/visibility/context.js";
import { buildVisibilityQuery } from "#methods/visibility/filter.js";
import { sanitizeAudience } from "#methods/visibility/helpers.js";

/** map objectType -> Mongoose model */
const MODEL = {
  activity: Activity,
  bookmark: Bookmark,
  circle: Circle,
  event: Event,
  file: File,
  flag: Flag,
  group: Group,
  page: Page,
  post: Post,
  react: React,
  reply: Reply,
  user: User,
  invite: Invite,
};

/** Build a safe projection.
 * - Always exclude `_id`.
 * - If caller uses **inclusion** (e.g. "id actorId to"), do NOT add `-__v` (Mongo forbids mixing).
 * - If caller uses **exclusion** or nothing, exclude `__v` as well.
 */
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
 * Get a visibility-filtered list of objects of a given type.
 *
 * @param {string} objectType              // "post" | "event" | "group" | ...
 * @param {object} opts
 * @param {string|null} opts.viewerId      // "@me@domain" or null/undefined for anon
 * @param {object} [opts.query]            // extra filters (ANDed with visibility)
 * @param {string|object} [opts.sort="-createdAt"] // mongoose sort string or object
 * @param {string|string[]} [opts.select]  // projection (see buildProjection)
 * @param {string|Date} [opts.before]      // cursor (createdAt < before)
 * @param {number} [opts.page]             // page (1-based) -- if provided, uses page mode
 * @param {number} [opts.itemsPerPage=20]
 * @param {boolean} [opts.deleted=false]   // include soft-deleted
 * @param {boolean} [opts.maskAudience=true] // mask circles as "@private"
 *
 * @returns {Promise<{items:any[], count:number, nextCursor:string|null, page?:number, itemsPerPage?:number, totalItems?:number}>}
 */
export default async function getVisibleCollection(objectType, opts = {}) {
  const {
    viewerId,
    query = {},
    sort = "-createdAt",
    select,
    before,
    page,
    itemsPerPage = 20,
    deleted = false,
    maskAudience = true,
  } = opts;

  const Model = MODEL[(objectType || "").toLowerCase()];
  if (!Model) throw new Error(`Unknown object type: ${objectType}`);

  // Build viewer context (circles, groups, blocks, domain)
  const ctx = await getViewerContext(viewerId);

  // Visibility filter (public / server / circles / groups, minus blocked)
  const vis = buildVisibilityQuery(ctx);

  // Soft-delete handling
  const base = deleted ? {} : { deletedAt: null };

  // Merge filters
  const filter = { ...base, ...vis, ...query };
  if (before) {
    filter.createdAt = { ...(filter.createdAt || {}), $lt: new Date(before) };
  }

  const projection = buildProjection(select);

  // Two pagination modes:
  // 1) Cursor (before+limit) -- default when 'page' is not provided
  if (!page) {
    const items = await Model.find(filter)
      .sort(sort)
      .limit(Number(itemsPerPage))
      .select(projection)
      .lean();

    const out = maskAudience
      ? items.map((i) => sanitizeAudience(i, ctx))
      : items;
    const nextCursor = out.length
      ? new Date(out[out.length - 1].createdAt).toISOString()
      : null;

    return { items: out, count: out.length, nextCursor };
  }

  // 2) Page-based (skip/limit + total)
  const p = Math.max(1, parseInt(page, 10));
  const ipp = Math.max(1, parseInt(itemsPerPage, 10));

  const [items, totalItems] = await Promise.all([
    Model.find(filter)
      .sort(sort)
      .skip((p - 1) * ipp)
      .limit(ipp)
      .select(projection)
      .lean(),
    Model.countDocuments(filter),
  ]);

  const out = maskAudience ? items.map((i) => sanitizeAudience(i, ctx)) : items;

  return {
    items: out,
    count: out.length,
    page: p,
    itemsPerPage: ipp,
    totalItems,
    nextCursor: null,
  };
}
