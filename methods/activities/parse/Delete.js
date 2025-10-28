// Delete.js (refactored)
import getObjectById from "#methods/get/objectById.js";
import { User } from "#schema";
import indefinite from "indefinite";
import { getSetting } from "#methods/settings/cache.js";

// Extract domain from various ID formats
function extractDomain(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) {
    return id.slice(at + 1).toLowerCase();
  }
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const asObject = (doc) =>
  doc?.toObject ? doc.toObject({ getters: true, virtuals: true }) : doc || null;

const sanitize = (obj) => {
  if (!obj) return obj;
  const clone = { ...obj };
  delete clone.__v;
  delete clone.password;
  delete clone.resetToken;
  delete clone.resetTokenExpiresAt;
  return clone;
};

const typeLabel = (item) =>
  item?.type || item?.objectType || item?.constructor?.modelName || "item";

export default async function del(activity) {
  if (!activity?.target) throw new Error("No target provided");

  // Fetch the item to delete
  const item = await getObjectById(activity.target);
  if (!item) {
    activity.error = new Error(`Target not found: ${activity.target}`);
    activity.summary = `Delete failed: target not found.`;
    return activity;
  }

  // Check admin/owner (fetch admin from DB to avoid trusting client)
  const user = await User.findOne({ id: activity.actorId }).lean();
  const isOwner =
    item.actorId &&
    activity.actorId &&
    String(item.actorId) === String(activity.actorId);
  const isAdmin = Boolean(user?.isAdmin);

  if (!isOwner && !isAdmin) {
    activity.error = new Error("Not authorized to delete this item");
    activity.summary = `Delete denied: you are not the owner or an admin.`;
    return activity;
  }

  // Idempotency: already deleted
  if (item.deletedAt) {
    activity.summary = `No-op: ${indefinite(
      typeLabel(item)
    )} was already deleted.`;
    activity.objectId = item.id || item._id?.toString?.();
    activity.object = sanitize(asObject(item));
    return activity;
  }

  // Perform soft-delete
  item.deletedAt = new Date();
  item.deletedBy = activity.actorId;
  if (activity?.object?.reason)
    item.deletedReason = String(activity.object.reason);
  await item.save();

  activity.objectId = item.id || item._id?.toString?.();
  activity.object = sanitize(asObject(item));
  activity.summary = `Deleted ${indefinite(typeLabel(item))} successfully.`;

  // Check if deleting a remote object
  const localDomain = getSetting("domain") || process.env.DOMAIN;
  const objectId = item.id || activity.target;
  const objectDomain = extractDomain(objectId);
  if (objectDomain && localDomain && objectDomain !== localDomain.toLowerCase()) {
    activity.federate = true;
  }

  return activity;
}
