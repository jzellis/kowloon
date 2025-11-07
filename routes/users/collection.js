// routes/users/collection.js
import route from "../utils/route.js";
import { User } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getDomain } from "#methods/settings/schemaHelpers.js";

/**
 * Determine if viewer can see user based on visibility
 * @param {Object} user - User document
 * @param {string} viewerId - Viewer's actorId
 * @param {boolean} isLocalUser - Is viewer a local authenticated user
 * @returns {boolean} Can viewer see this user
 */
function canViewUser(user, viewerId, isLocalUser) {
  const domain = getDomain();
  const toValue = String(user.to || "").toLowerCase().trim();

  // Public users are visible to everyone
  if (toValue === "@public" || toValue === "public") {
    return true;
  }

  // Server-only users are visible only to local authenticated users
  if (toValue === `@${domain}` || toValue === "server") {
    return isLocalUser;
  }

  // For audience-restricted users, viewer must be authenticated
  // and we'd need to check Circle/Group membership (not implemented here)
  // For now, return false for non-public, non-server users when unauthenticated
  return isLocalUser;
}

/**
 * Sanitize user object to only include safe public fields
 * @param {Object} user - Full user document
 * @returns {Object} Sanitized user with limited fields
 */
function sanitizeUserForPublic(user) {
  return {
    id: user.id,
    type: user.type || "Person",
    username: user.username,
    profile: user.profile
      ? {
          name: user.profile.name,
          subtitle: user.profile.subtitle,
          description: user.profile.description,
          urls: user.profile.urls,
          pronouns: user.profile.pronouns,
          icon: user.profile.icon,
          // Exclude location for privacy
        }
      : undefined,
    publicKey: user.publicKey,
    url: user.url,
    inbox: user.inbox,
    outbox: user.outbox,
    // Exclude: password, email, privateKey, prefs, following, blocked, muted, etc.
  };
}

export default route(async ({ req, query, set }) => {
  const { page, limit } = query;

  const pageNum = page ? Number(page) : 1;
  const itemsPerPage = limit ? Number(limit) : 20;
  const offset = pageNum && pageNum > 1 ? (pageNum - 1) * itemsPerPage : 0;

  // Determine if viewer is a local authenticated user
  const viewerId = req.user?.id;
  let isLocalUser = false;
  if (viewerId) {
    const parsed = kowloonId(viewerId);
    isLocalUser = parsed.domain && isLocalDomain(parsed.domain);
  }

  // Build query for users
  const userQuery = {
    deletedAt: null,
    active: true,
  };

  // If unauthenticated or remote user, only show public users
  if (!viewerId || !isLocalUser) {
    userQuery.to = "@public";
  }

  // Query users
  const [users, total] = await Promise.all([
    User.find(userQuery)
      .select("id type username profile publicKey url inbox outbox to")
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(itemsPerPage)
      .lean(),
    User.countDocuments(userQuery),
  ]);

  // Filter by visibility and sanitize
  const items = users
    .filter((user) => canViewUser(user, viewerId, isLocalUser))
    .map(sanitizeUserForPublic);

  // Build collection URL
  const domain = getSetting("domain");
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${protocol}://${domain}/users`;
  const fullUrl = pageNum ? `${baseUrl}?page=${pageNum}` : baseUrl;

  // Build ActivityStreams OrderedCollection
  const collection = activityStreamsCollection({
    id: fullUrl,
    orderedItems: items,
    totalItems: total,
    page: pageNum,
    itemsPerPage,
    baseUrl,
  });

  // Set response fields
  for (const [key, value] of Object.entries(collection)) {
    set(key, value);
  }
});
