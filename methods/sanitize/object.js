// /methods/sanitize/object.js
// Sanitize objects for public/authenticated/owner access

/**
 * Sanitize a User object - always return public fields only.
 * Returns a full ActivityPub actor document.
 */
function sanitizeUser(user) {
  if (!user) return null;

  const actorId = user.actorId || user.id;

  // Full AP publicKey object (required for HTTP signature verification)
  const publicKeyObj = user.publicKey
    ? {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem: user.publicKey,
      }
    : undefined;

  // Derive followers/following collection URLs from inbox/outbox pattern
  let followersUrl, followingUrl;
  if (user.inbox) {
    const base = user.inbox.replace(/\/inbox$/, "");
    followersUrl = `${base}/followers`;
    followingUrl = `${base}/following`;
  }

  // Shared inbox (server-level inbox for efficient delivery)
  let sharedInbox;
  if (user.inbox) {
    try {
      const url = new URL(user.inbox);
      sharedInbox = `${url.protocol}//${url.host}/inbox`;
    } catch {
      sharedInbox = undefined;
    }
  }

  // Normalize icon to AP Image object
  let iconObj;
  if (user.profile?.icon) {
    iconObj = typeof user.profile.icon === "string"
      ? { type: "Image", url: user.profile.icon }
      : user.profile.icon;
  }

  return {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    id: actorId,
    type: user.type || "Person",
    objectType: user.objectType || "User",
    preferredUsername: user.username,
    name: user.profile?.name || user.username,
    summary: user.profile?.description ?? null,
    icon: iconObj ?? null,
    url: user.url || actorId,
    inbox: user.inbox,
    outbox: user.outbox,
    followers: followersUrl,
    following: followingUrl,
    ...(sharedInbox ? { endpoints: { sharedInbox } } : {}),
    publicKey: publicKeyObj,
  };
}

/**
 * Remove internal MongoDB fields from any object
 */
function removeInternalFields(obj) {
  const sanitized = { ...obj };
  // MongoDB internal fields
  delete sanitized._id;
  delete sanitized.__v;
  // Security-sensitive fields
  delete sanitized.password;
  delete sanitized.privateKey;
  delete sanitized.privateKeyPem;
  // Kowloon internal fields
  delete sanitized.cached;
  delete sanitized.tombstoned;
  return sanitized;
}

/**
 * Sanitize any object based on type
 */
export default function sanitizeObject(obj, { objectType = null } = {}) {
  if (!obj) return null;

  const type = objectType || obj.objectType || obj.type;

  // User objects have special handling
  if (type === "User" || type === "Person") {
    return sanitizeUser(obj);
  }

  // For all other objects, just remove internal fields
  return removeInternalFields(obj);
}
