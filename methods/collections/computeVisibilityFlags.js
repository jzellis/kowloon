// /methods/collections/computeVisibilityFlags.js
// Computes per-viewer visibility flags: public, server, canReply, canReact

import { Post, Reply, Circle, Group, Event, User } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";
import { getDomain } from "#methods/settings/schemaHelpers.js";

const SOURCE_MODELS = {
  Post,
  Reply,
  Circle,
  Group,
  Event,
};

/**
 * Check if viewer is member of a Circle/Group/Event
 * @param {string} viewerId - Viewer's actorId
 * @param {string} entityId - Circle/Group/Event ID
 * @returns {Promise<boolean>}
 */
async function isMemberOf(viewerId, entityId) {
  if (!entityId || !viewerId) return false;

  const parsed = kowloonId(entityId);
  if (!parsed?.type) return false;

  let Model;
  if (parsed.type === "circle") Model = Circle;
  else if (parsed.type === "group") Model = Group;
  else if (parsed.type === "event") Model = Event;
  else return false;

  const entity = await Model.findOne({ id: entityId }).select("members").lean();
  if (!entity || !entity.members) return false;

  return entity.members.some((m) => m.id === viewerId);
}

/**
 * Check if viewer follows author
 * @param {string} viewerId - Viewer's actorId
 * @param {string} authorId - Author's actorId
 * @returns {Promise<boolean>}
 */
async function followsAuthor(viewerId, authorId) {
  if (!viewerId || !authorId) return false;

  const user = await User.findOne({ id: viewerId }).select("following").lean();
  if (!user || !user.following) return false;

  const circle = await Circle.findOne({ id: user.following })
    .select("members")
    .lean();
  if (!circle || !circle.members) return false;

  return circle.members.some((m) => m.id === authorId);
}

/**
 * Evaluate capability (canReply/canReact) for a viewer
 * @param {string} value - Original capability value from source object
 * @param {string} viewerId - Viewer's actorId
 * @param {string} authorId - Author's actorId
 * @param {boolean} isLocalUser - Is viewer a local authenticated user
 * @returns {Promise<boolean>}
 */
async function evaluateCapability(value, viewerId, authorId, isLocalUser) {
  if (!value) return true; // default to public

  const domain = getDomain();
  const v = String(value).toLowerCase().trim();

  // @public or public → always true
  if (v === "@public" || v === "public") return true;

  // @<server> → true if local authenticated user
  if (v === `@${domain}` || v === "server") return isLocalUser;

  // "followers" → check if viewer follows author
  if (v === "followers") {
    if (!isLocalUser) return false;
    return await followsAuthor(viewerId, authorId);
  }

  // "none" → always false
  if (v === "none") return false;

  // Circle/Group/Event ID → check membership
  if (
    v.startsWith("circle:") ||
    v.startsWith("group:") ||
    v.startsWith("event:")
  ) {
    if (!isLocalUser) return false;
    return await isMemberOf(viewerId, value);
  }

  // "audience" or unknown → false (requires source object audience check)
  return false;
}

/**
 * Compute visibility flags for a collection item
 * @param {Object} item - FeedItems item
 * @param {string} viewerId - Viewer's actorId (or undefined for unauth)
 * @param {boolean} isLocalUser - Is viewer a local authenticated user
 * @returns {Promise<Object>} { public, server, canReply, canReact }
 */
export default async function computeVisibilityFlags(
  item,
  viewerId,
  isLocalUser
) {
  const domain = getDomain();

  // Default flags for unauthenticated users viewing public items
  if (!viewerId || !isLocalUser) {
    return {
      public: true, // Always true for unauthenticated (only see public items)
      server: false,
      canReply: false, // Unauthenticated users can NEVER reply (accountability)
      canReact: false, // Unauthenticated users can NEVER react (accountability)
    };
  }

  // For authenticated local users, we need to check original source object
  // to get the original to/canReply/canReact values (not normalized enums)
  const parsed = kowloonId(item.id);
  const Model = SOURCE_MODELS[parsed?.type];

  let sourceObject = null;
  if (Model) {
    sourceObject = await Model.findOne({ id: item.id })
      .select("to canReply canReact")
      .lean();
  }

  // Determine visibility flags
  const toValue = sourceObject?.to || item.to;
  const toNormalized = String(toValue || "")
    .toLowerCase()
    .trim();

  const flags = {
    public: toNormalized === "@public" || toNormalized === "public",
    server: toNormalized === `@${domain}` || toNormalized === "server",
    canReply: false,
    canReact: false,
  };

  // Evaluate capabilities from source object (original values, not FeedItems enums)
  if (sourceObject) {
    flags.canReply = await evaluateCapability(
      sourceObject.canReply,
      viewerId,
      item.actorId,
      isLocalUser
    );
    flags.canReact = await evaluateCapability(
      sourceObject.canReact,
      viewerId,
      item.actorId,
      isLocalUser
    );
  } else {
    // Fallback to FeedItems enums if source not available
    flags.canReply = item.canReply === "public";
    flags.canReact = item.canReact === "public";
  }

  return flags;
}
