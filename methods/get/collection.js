// methods/objects/getFromCollection.js
import {
  Activity,
  Bookmark,
  Circle,
  Group,
  Event,
  Page,
  Post,
  React,
  Reply,
  User,
  Invite,
  File,
  Flag,
} from "#schema";

/** Default selects per collection (mirror existing style) */
const DEFAULT_SELECT = {
  activity: " -deletedAt -deletedBy -_id -__v -source",
  bookmark: " -deletedAt -deletedBy -_id -__v -source",
  circle: "-deletedAt -deletedBy -_id -__v -source -members",
  group: " -deletedAt -deletedBy -_id -__v -source",
  event: " -deletedAt -deletedBy -_id -__v -source",
  page: " -deletedAt -deletedBy -_id -__v -source",
  post: " -deletedAt -deletedBy -_id -__v -source -signature",
  reply: " -deletedAt -deletedBy -_id -__v -source",
  react: " -deletedAt -deletedBy -_id -__v -source",
  user: "-_id username id profile publicKey",
  invite: " -deletedAt -deletedBy -_id -__v", // adjust if you expose codes/emails
  file: " -deletedAt -deletedBy -_id -__v", // hide internals
  flag: " -deletedAt -deletedBy -_id -__v", // hide moderation internals by default
};

/** Model map (singular + plural keys) */
const COLLECTIONS = {
  activity: Activity,
  activities: Activity,
  bookmark: Bookmark,
  bookmarks: Bookmark,
  circle: Circle,
  circles: Circle,
  group: Group,
  groups: Group,
  event: Event,
  events: Event,
  page: Page,
  pages: Page,
  post: Post,
  posts: Post,
  reply: Reply,
  replies: Reply,
  react: React,
  reacts: React,
  user: User,
  users: User,
  invite: Invite,
  invites: Invite,
  file: File,
  files: File,
  flag: Flag,
  flags: Flag,
};

function normalizeKey(type) {
  if (!type || typeof type !== "string")
    throw new Error("type must be a string");
  return type.trim().toLowerCase();
}

function defaultSelectFor(key) {
  const singular = key.endsWith("s") ? key.slice(0, -1) : key;
  return DEFAULT_SELECT[singular] || "";
}

function deletedFilter(deleted) {
  if (deleted === true) return { deletedAt: { $exists: true, $ne: null } };
  return { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] };
}

/**
 * Get many items from any Kowloon collection.
 * (list-only; never returns a single record)
 */
export default async function getFromCollection(type, opts = {}) {
  const key = normalizeKey(type);
  const Model = COLLECTIONS[key];
  if (!Model) throw new Error(`Unknown collection type: "${type}"`);

  const {
    query = {},
    page,
    itemsPerPage = 20,
    sort = "-updatedAt",
    select = defaultSelectFor(key),
    deleted = false,
  } = opts;

  const filter = { ...query, ...deletedFilter(deleted) };
  let q = Model.find(filter).select(select).sort(sort).lean();

  if (typeof page === "number" && Number.isFinite(page)) {
    const p = Math.max(1, Math.floor(page));
    const ipp = Math.max(1, Math.floor(itemsPerPage));
    const [items, totalItems] = await Promise.all([
      q.skip((p - 1) * ipp).limit(ipp),
      Model.countDocuments(filter),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / ipp));
    return { items, totalItems, page: p, itemsPerPage: ipp, totalPages };
  }

  const [items, totalItems] = await Promise.all([
    q,
    Model.countDocuments(filter),
  ]);
  return { items, totalItems };
}
