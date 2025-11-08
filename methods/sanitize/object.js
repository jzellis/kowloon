// /methods/sanitize/object.js
// Sanitize objects for public/authenticated/owner access

/**
 * Sanitize a User object - always return public fields only
 */
function sanitizeUser(user) {
  if (!user) return null;

  // Always return only public fields
  return {
    id: user.id,
    username: user.username,
    profile: user.profile,
    publicKey: user.publicKey,
    type: user.type || "Person",
    objectType: user.objectType || "User",
    url: user.url,
    inbox: user.inbox,
    outbox: user.outbox,
  };
}

/**
 * Remove internal MongoDB fields from any object
 */
function removeInternalFields(obj) {
  const sanitized = { ...obj };
  delete sanitized._id;
  delete sanitized.__v;
  delete sanitized.password;
  delete sanitized.privateKey;
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
