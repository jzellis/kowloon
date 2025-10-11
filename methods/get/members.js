// #methods/get/members.js
import { Circle, Group, Event } from "#schema";
import { getViewerContext } from "#methods/visibility/context.js";

const MODEL = {
  circle: Circle,
  group: Group,
  event: Event,
};

/**
 * Get embedded members for a parent object, with auth.
 *
 * @param {"circle"|"group"|"event"} objectType
 * @param {string} parentId            // e.g. "circle:uuid@domain"
 * @param {object} opts
 * @param {string|null} opts.viewerId
 * @param {("members"|"pending"|"attending"|"invited")} [opts.path="members"]
 * @param {number} [opts.limit=100]
 * @param {string|Date} [opts.before]  // cursor on subdoc.createdAt (if timestamps enabled)
 * @returns {Promise<{items: any[], count: number, nextCursor: string|null}>}
 */
export default async function getMembers(objectType, parentId, opts = {}) {
  const { viewerId = null, path = "members", limit = 100, before } = opts;

  const Model = MODEL[(objectType || "").toLowerCase()];
  if (!Model) throw new Error(`Unknown object type: ${objectType}`);

  // Pull only what we need
  const parent = await Model.findOne({ id: parentId, deletedAt: null })
    .select(`id actorId ${path}`)
    .lean();

  if (!parent) return { items: [], count: 0, nextCursor: null };

  // Visibility: owner OR member (for groups: member; for events: attending/invited)
  const ctx = await getViewerContext(viewerId);
  const isOwner = viewerId && parent.actorId === viewerId;

  // Which array are we reading?
  const arr = Array.isArray(parent[path]) ? parent[path] : [];

  const isMember = viewerId && arr.some((m) => m?.id === viewerId);

  // Policy:
  // - Circles: owner or member can view "members"
  // - Groups:  owner or member can view "members"; owner can also view "pending" if you expose it
  // - Events:  owner or attendee can view "attending"; owner or invitee can view "invited"
  if (!isOwner && !isMember) {
    return { items: [], count: 0, nextCursor: null };
  }

  // Sort newest→oldest by subdoc.createdAt if present (timestamps on subdoc recommended)
  const sorted = [...arr].sort((a, b) => {
    const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Cursor by createdAt (optional)
  let sliced = sorted;
  if (before) {
    const t = new Date(before).getTime();
    sliced = sorted.filter((m) =>
      m?.createdAt ? new Date(m.createdAt).getTime() < t : false
    );
  }

  const page = sliced.slice(0, Number(limit));

  // Build next cursor if we have createdAt timestamps
  const last = page[page.length - 1];
  const nextCursor = last?.createdAt
    ? new Date(last.createdAt).toISOString()
    : null;

  // Sanitize/shape subdocs (keep small; omit internal fields)
  const items = page.map(
    ({ id, name, icon, url, inbox, outbox, server, createdAt, updatedAt }) => ({
      id,
      name,
      icon,
      url,
      inbox,
      outbox,
      server,
      createdAt,
      updatedAt,
    })
  );

  return { items, count: items.length, nextCursor };
}
