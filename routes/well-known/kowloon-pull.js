// /routes/well-known/kowloon-pull.js
// GET /.well-known/kowloon/pull
// Federation pull endpoint - remote servers request content from this server

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

/**
 * Extract domain from actor ID or URL
 */
function extractDomain(str) {
  try {
    // Try URL parsing first
    const url = new URL(str);
    return url.hostname;
  } catch {
    // Fall back to @user@domain parsing
    const parts = str.split('@');
    return parts[parts.length - 1];
  }
}

export default route(
  async (api) => {
    const { req, setStatus, set } = api;

    // 1. Verify HTTP Signature (server-to-server authentication)
    const sig = await Kowloon.federation.verifyHttpSignature(req);
    if (!sig.ok) {
      logger.warn("kowloon-pull: HTTP Signature verification failed", {
        error: sig.error,
        headers: req.headers,
      });
      setStatus(401);
      set({ error: sig.error || "Invalid HTTP Signature" });
      return;
    }

    const requestingDomain = sig.domain;
    logger.info("kowloon-pull: Request verified", { domain: requestingDomain });

    // 2. Parse query parameters
    const members = parseArray(req.query.members);
    const authors = parseArray(req.query.authors);
    const groups = parseArray(req.query.groups);
    const types = parseArray(req.query.types);
    const since = req.query.since; // ISO 8601 timestamp
    const limit = Math.min(Number(req.query.limit) || 50, 500); // Max 500

    logger.info("kowloon-pull: Query parameters", {
      members: members.length,
      authors: authors.length,
      groups: groups.length,
      types: types.length,
      since,
      limit,
    });

    // 3. Validate that at least one filter is provided
    if (members.length === 0 && authors.length === 0 && groups.length === 0) {
      setStatus(400);
      set({ error: "At least one filter parameter required (members, authors, or groups)" });
      return;
    }

    // 4. Filter to only local content
    const { domain: ourDomain } = getServerSettings();

    // Filter authors to only local users
    const localAuthors = authors.filter(actorId => {
      const domain = extractDomain(actorId);
      return domain === ourDomain;
    });

    // Filter groups to only local groups
    const localGroups = groups.filter(groupId => {
      const domain = extractDomain(groupId);
      return domain === ourDomain;
    });

    // 5. Query items using unified query builder
    try {
      const items = await Kowloon.feed.queryItems({
        members,
        authors: localAuthors,
        groups: localGroups,
        types,
        since,
        limit,
        requestingDomain,
      });

      logger.info("kowloon-pull: Retrieved items", {
        count: items.length,
        requestingDomain,
      });

      // 6. Return ActivityStreams OrderedCollection
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
      logger.error("kowloon-pull: Query failed", {
        error: error.message,
        stack: error.stack,
      });
      setStatus(500);
      set({ error: "Internal server error" });
    }
  },
  { allowUnauth: true } // Server-to-server - authenticates via HTTP Signature
);
