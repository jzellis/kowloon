// /methods/sanitize/object.js
// Sanitize objects for public/authenticated/owner access.
//
// User profiles are always visible at a baseline (so discovery and follow flows
// keep working) but personal-info fields can be gated to @public or @<domain>
// via the user's `to` setting. See `pickProfileFields` below for the split.

const PERSONAL_FIELDS = ["description", "urls", "pronouns", "location", "subtitle"];

// Decide whether a viewer should see audience-gated personal info on a user.
// `viewer` is the viewer-context object (see methods/visibility/context.js)
// or `null` for an anonymous request (e.g. remote AP fetch with no signature).
function canSeePersonalInfo(user, viewer) {
  const to = user?.to || "@public";

  // Owner sees everything about themselves.
  if (viewer?.viewerId && viewer.viewerId === user?.id) return true;

  if (to === "@public") return true;

  // Server-restricted: viewer must be authenticated AND on the same server
  // as this user. Domain comes from user.domain (preferred) or by parsing
  // the user.id handle (`@user@domain`).
  const userDomain = user?.domain || (typeof user?.id === "string" ? user.id.split("@").pop() : null);
  if (typeof to === "string" && to.startsWith("@") && to !== "@public") {
    const audienceDomain = to.slice(1);
    return !!(viewer?.isAuthenticated && viewer?.viewerDomain && viewer.viewerDomain === audienceDomain && audienceDomain === userDomain);
  }

  // Anything else (legacy circle/group IDs, etc.) — gated.
  return false;
}

function pickProfileFields(profile, includePersonal) {
  if (!profile) return {};
  const picked = {};
  if (profile.name != null) picked.name = profile.name;
  if (profile.icon != null) picked.icon = profile.icon;
  if (includePersonal) {
    for (const k of PERSONAL_FIELDS) {
      if (profile[k] != null) picked[k] = profile[k];
    }
  }
  return picked;
}

/**
 * Sanitize a User object. Returns a full ActivityPub actor document with
 * personal-info fields gated by the user's `to` audience.
 *
 * @param {object} user
 * @param {object|null} viewer  viewer context from getViewerContext()
 */
function sanitizeUser(user, viewer = null) {
  if (!user) return null;

  const actorId = user.actorId || user.id;
  const personal = canSeePersonalInfo(user, viewer);
  const profile  = pickProfileFields(user.profile, personal);

  const publicKeyObj = user.publicKey
    ? {
        id: `${actorId}#main-key`,
        owner: actorId,
        publicKeyPem: user.publicKey,
      }
    : undefined;

  let followersUrl, followingUrl;
  if (user.inbox) {
    const base = user.inbox.replace(/\/inbox$/, "");
    followersUrl = `${base}/followers`;
    followingUrl = `${base}/following`;
  }

  let sharedInbox;
  if (user.inbox) {
    try {
      const url = new URL(user.inbox);
      sharedInbox = `${url.protocol}//${url.host}/inbox`;
    } catch {
      sharedInbox = undefined;
    }
  }

  let iconObj;
  if (profile.icon) {
    iconObj = typeof profile.icon === "string"
      ? { type: "Image", url: profile.icon }
      : profile.icon;
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
    name: profile.name || user.username,
    summary: personal ? (user.profile?.description ?? null) : null,
    icon: iconObj ?? null,
    url: user.url || actorId,
    inbox: user.inbox,
    outbox: user.outbox,
    followers: followersUrl,
    following: followingUrl,
    ...(sharedInbox ? { endpoints: { sharedInbox } } : {}),
    publicKey: publicKeyObj,
    // Kowloon-flavoured handle — always visible
    handle: user.id,
    domain: user.domain,
    // Personal-info subset, only when audience permits
    ...(personal ? {
      profile: {
        name: profile.name ?? null,
        subtitle: profile.subtitle ?? null,
        description: profile.description ?? null,
        urls: profile.urls ?? [],
        pronouns: profile.pronouns ?? null,
        location: profile.location ?? null,
        icon: profile.icon ?? null,
      },
    } : {
      profile: {
        name: profile.name ?? null,
        icon: profile.icon ?? null,
      },
      audienceRestricted: true,
    }),
  };
}

/**
 * Gate the personal-info subset of a user's `profile` for a given viewer,
 * returning a shallow-cleaned profile that keeps the always-visible fields
 * (name, icon, ...) and drops audience-gated fields when the viewer isn't
 * permitted. Used by lean consumers (e.g. search) that want the gating rules
 * without the full ActivityPub actor shape sanitizeUser produces.
 *
 * @param {object} user    user doc (needs `to`, `domain`/`id`, `profile`)
 * @param {object|null} viewer  viewer context from getViewerContext()
 * @returns {object} profile with personal fields stripped if not permitted
 */
export function gateUserProfile(user, viewer = null) {
  const profile = user?.profile || {};
  if (canSeePersonalInfo(user, viewer)) return { ...profile };
  const gated = { ...profile };
  for (const k of PERSONAL_FIELDS) delete gated[k];
  return gated;
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
  delete sanitized.privateKeyPem;
  delete sanitized.cached;
  delete sanitized.tombstoned;
  return sanitized;
}

/**
 * Sanitize any object based on type
 *
 * @param {object} obj
 * @param {object} [opts]
 * @param {string} [opts.objectType]
 * @param {object} [opts.viewer]  viewer context (see methods/visibility/context.js)
 */
export default function sanitizeObject(obj, { objectType = null, viewer = null } = {}) {
  if (!obj) return null;

  const type = objectType || obj.objectType || obj.type;

  if (type === "User" || type === "Person") {
    return sanitizeUser(obj, viewer);
  }

  return removeInternalFields(obj);
}
