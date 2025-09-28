// Update.js (refactored)
import getObjectById from "../getObjectById.js";
import indefinite from "indefinite";

const sanitize = (obj) => {
  if (!obj) return obj;
  const clone = { ...obj };
  delete clone.__v;
  delete clone.password;
  delete clone.resetToken;
  delete clone.resetTokenExpiresAt;
  return clone;
};

// Per-type editable fields (expand as your schemas evolve)
const EDITABLE_FIELDS = {
  default: new Set([
    "title",
    "name",
    "summary",
    "subtitle",
    "description",
    "content",
    "tags",
    "urls",
    "startTime",
    "endTime",
    "location",
    "visibility",
    "prefs",
    "profile", // if you allow profile edits (nested)
    // add more allowed fields here
  ]),
  User: new Set([
    // strictly define what a user can change about themselves:
    "profile",
    "prefs",
    "email", // only if allowed; consider separate flow for email changes
    // DO NOT include: "id", "actorId", "isAdmin", "password" (unless handled specially)
  ]),
  Post: new Set(["title", "summary", "content", "tags", "visibility"]),
  Group: new Set(["name", "summary", "description", "rules", "visibility"]),
  Circle: new Set(["name", "summary", "description"]),
  Event: new Set([
    "title",
    "summary",
    "description",
    "startTime",
    "endTime",
    "location",
    "visibility",
  ]),
  Page: new Set(["title", "summary", "content"]),
  Bookmark: new Set([
    "title",
    "summary",
    "description",
    "url",
    "tags",
    "parent",
  ]),
  File: new Set(["title", "alt", "description"]),
};

const DISALLOWED_ALWAYS = new Set([
  "id",
  "_id",
  "actorId",
  "actor",
  "server",
  "objectType",
  "type", // avoid changing the polymorphic type
  "createdAt",
  "updatedAt",
  "__v",
  // security-sensitive:
  "isAdmin",
  "roles",
  "password",
  "resetToken",
  "resetTokenExpiresAt",
]);

const getPossAdj = (activity) =>
  activity?.actor?.profile?.pronouns?.possAdj ||
  activity?.actor?.profile?.pronouns?.possessive ||
  "their";

const getItemTypeLabel = (item) =>
  item?.type || item?.objectType || item?.constructor?.modelName || "item";

export default async function update(activity) {
  if (!activity?.target) throw new Error("No target provided");
  if (!activity?.object) throw new Error("No object provided");

  const item = await getObjectById(activity.target);
  if (!item) throw new Error(`Target not found: ${activity.target}`);

  // Authorization: owner or admin (adjust to your policy)
  const isOwner =
    item.actorId &&
    activity.actorId &&
    String(item.actorId) === String(activity.actorId);
  const isAdmin = Boolean(activity?.actor?.isAdmin); // or fetch fresh from DB if needed
  if (!isOwner && !isAdmin) {
    throw new Error("Not authorized to update this item");
  }

  // Determine allowed fields for this type
  const typeKey =
    item.type || item.objectType || item.constructor?.modelName || "default";
  const allowed = EDITABLE_FIELDS[typeKey] || EDITABLE_FIELDS.default;

  // Build a safe $set object
  const updates = {};
  for (const [key, value] of Object.entries(activity.object)) {
    // reject path injection and specials
    if (!key || key.includes("$") || key.includes(".")) continue;
    if (DISALLOWED_ALWAYS.has(key)) continue;
    if (!allowed.has(key)) continue;
    updates[key] = value;
  }

  // Nothing to update? Return early with a no-op summary.
  if (Object.keys(updates).length === 0) {
    activity.summary = `${activity.actor?.profile?.name || "Someone"} (${
      activity.actor?.id || activity.actorId || "unknown actor"
    }) made no changes to ${getPossAdj(activity)} ${getItemTypeLabel(
      item
    )} (no allowed fields).`;
    activity.objectId = item.id || item._id?.toString?.();
    activity.object = sanitize(item.toObject?.() ? item.toObject() : item);
    return activity;
  }

  // Apply updates and save (runs schema validators)
  item.set(updates);
  await item.save();

  // Prepare response
  const possAdj = getPossAdj(activity);
  const itemType = getItemTypeLabel(item);
  activity.summary = `${activity.actor?.profile?.name || "Someone"} (${
    activity.actor?.id || activity.actorId || "unknown actor"
  }) updated ${possAdj} ${indefinite(itemType)}.`;
  activity.objectId = item.id || item._id?.toString?.();
  activity.object = sanitize(item.toObject?.() ? item.toObject() : item);

  return activity;
}
