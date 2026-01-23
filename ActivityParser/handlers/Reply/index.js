// #ActivityParser/handlers/Reply/index.js
// Canonicalizes Reply → Create/Post with object.type = "Reply" and calls Create handler.

import Create from "../Create/index.js";

/**
 * Type-specific validation for Reply activities
 * Per specification: objectType REQUIRED (should always be "Reply"), object REQUIRED, to REQUIRED (Post ID)
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Reply: missing activity.actorId");
  }

  // Required: objectType (should be "Reply")
  if (!activity?.objectType || typeof activity.objectType !== "string") {
    errors.push("Reply: missing required field 'objectType'");
  }

  if (activity?.objectType && activity.objectType !== "Reply") {
    errors.push("Reply: objectType should be 'Reply'");
  }

  // Required: object
  if (!activity?.object || typeof activity.object !== "object") {
    errors.push("Reply: missing required field 'object'");
  }

  // Required: to (Post ID being replied to)
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("Reply: missing required field 'to' (Post ID)");
  }

  // object.inReplyTo is required
  if (!activity.object?.inReplyTo || typeof activity.object.inReplyTo !== "string") {
    errors.push("Reply: object.inReplyTo (string) is required");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for Reply activity
 * Replies are handled by the Create handler, which will determine federation
 * @param {Object} activity - The activity envelope
 * @param {Object} created - The created reply
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, created) {
  // Federation is handled by the Create handler
  return { shouldFederate: false };
}

export default async function Reply(activity, ctx = {}) {
  // 1. Validate
  const validation = validate(activity);
  if (!validation.valid) {
    return { activity, error: validation.errors.join("; ") };
  }

  // 2. Canonicalize to Create activity
  const a = { ...activity };
  a.type = "Create";
  a.objectType = "Post";
  a.object = { ...(a.object || {}) };
  a.object.type = "Reply";

  // Ensure inReplyTo is set from the 'to' field if not already present
  if (!a.object.inReplyTo) {
    a.object.inReplyTo = activity.to;
  }

  // 3. Delegate to Create handler to persist the Post/Reply
  return await Create(a, ctx);
}
