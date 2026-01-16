// /routes/feed/pull.js
// GET /feed/pull
// Local feed pull endpoint - users/apps request content from this server

import route from "../utils/route.js";
import Kowloon from "#kowloon";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import logger from "#methods/utils/logger.js";

/**
 * Parse comma-separated query param into array
 */
function parseArray(param) {
  if (!param) return [];
  if (Array.isArray(param)) return param;
  return String(param).split(',').map(s => s.trim()).filter(Boolean);
}

export default route(async (api) => {
  const { req, user, setStatus, set } = api;

  // Parse query parameters (same as federation endpoint)
  const members = parseArray(req.query.members);
  const authors = parseArray(req.query.authors);
  const groups = parseArray(req.query.groups);
  const events = parseArray(req.query.events);
  const since = req.query.since; // ISO 8601 timestamp
  const limit = Math.min(Number(req.query.limit) || 50, 500); // Max 500

  logger.info("feed/pull: Local query", {
    user: user?.id,
    members: members.length,
    authors: authors.length,
    groups: groups.length,
    events: events.length,
    since,
    limit,
  });

  // Validate that at least one filter is provided
  if (members.length === 0 && authors.length === 0 && groups.length === 0 && events.length === 0) {
    setStatus(400);
    set({ error: "At least one filter parameter required (members, authors, groups, or events)" });
    return;
  }

  // If user is authenticated, restrict members filter to the authenticated user
  // (prevents users from querying other users' private content)
  let filteredMembers = members;
  if (user) {
    // Authenticated: only allow querying for this user
    if (members.length > 0 && !members.includes(user.id)) {
      logger.warn("feed/pull: User attempted to query other users' content", {
        user: user.id,
        requestedMembers: members,
      });
      setStatus(403);
      set({ error: "Cannot query content for other users" });
      return;
    }
    filteredMembers = members.length > 0 ? [user.id] : [];
  } else {
    // Unauthenticated: only public content (no members filter allowed)
    if (members.length > 0) {
      setStatus(401);
      set({ error: "Authentication required to filter by members" });
      return;
    }
    filteredMembers = [];
  }

  // Query items using unified query builder
  try {
    const { domain } = getServerSettings();

    const items = await Kowloon.feed.queryItems({
      members: filteredMembers,
      authors,
      groups,
      events,
      since,
      limit,
      requestingDomain: domain, // Local queries use our own domain
    });

    logger.info("feed/pull: Retrieved items", {
      count: items.length,
      user: user?.id,
    });

    // Return ActivityStreams OrderedCollection
    setStatus(200);
    set({
      "@context": "https://www.w3.org/ns/activitystreams",
      type: "OrderedCollection",
      totalItems: items.length,
      orderedItems: items,
      // Include cursor for pagination
      ...(items.length > 0 && {
        next: items[items.length - 1].publishedAt.toISOString(),
      }),
    });
  } catch (error) {
    logger.error("feed/pull: Query failed", {
      error: error.message,
      stack: error.stack,
      user: user?.id,
    });
    setStatus(500);
    set({ error: "Internal server error" });
  }
});
