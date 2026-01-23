// /methods/sanitize/object.js
// Sanitize objects for public/authenticated/owner access

/**
 * Sanitize a User object - always return public fields only
 */
function sanitizeUser(user) {
  if (!user) return null;

  // Build ActivityPub-compatible publicKey object
  const publicKeyObj = user.publicKey
    ? {
        id: `${user.actorId || user.id}#main-key`,
        owner: user.actorId || user.id,
        publicKeyPem: user.publicKey,
      }
    : undefined;

  // Always return only public fields
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: user.actorId || user.id,
    type: user.type || "Person",
    objectType: user.objectType || "User",
    preferredUsername: user.username,
    name: user.profile?.name || user.username,
    summary: user.profile?.description,
    icon: user.profile?.icon,
    url: user.url || user.actorId || user.id,
    inbox: user.inbox,
    outbox: user.outbox,
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
