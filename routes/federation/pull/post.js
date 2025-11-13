// /routes/federation/pull/post.js
// SERVER endpoint: POST /federation/pull
// Remote server A calls our server B's /federation/pull endpoint

import route from "../../utils/route.js";
import { FeedCache, Server } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import verifyPullJwt from "#methods/federation/verifyPullJwt.js";

/**
 * Normalize domain to lowercase, remove scheme/port
 */
function normalizeDomain(domain) {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^@/, "")
    .replace(/:\d+$/, "");
}

export default route(
  async (api) => {
    const { req, body, setStatus, set } = api;

    // Get our domain for JWT verification
    const { domain: ourDomain } = getServerSettings();

    // Extract and verify JWT
    let requestingDomain;
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);

      try {
        const verified = await verifyPullJwt(token, `https://${ourDomain}`);
        requestingDomain = verified.domain;
        console.log(`Pull server: Verified request from ${requestingDomain}`);
      } catch (err) {
        console.error(`Pull server: JWT verification failed:`, err.message);
        setStatus(401);
        set({ error: "Invalid or expired token" });
        return;
      }
    } else {
      setStatus(401);
      set({ error: "Missing Authorization header" });
      return;
    }

    // Check if the requesting server is registered and not blocked
    const requestingServer = await Server.findOne({ domain: requestingDomain });
    if (!requestingServer) {
      console.log(`Pull server: Server ${requestingDomain} not registered`);
      setStatus(403);
      set({ error: "Server not registered" });
      return;
    }

    if (requestingServer.status === "blocked") {
      console.log(`Pull server: Server ${requestingDomain} is blocked`);
      setStatus(403);
      set({ error: "Server is blocked" });
      return;
    }

    // Parse request
    const actors = Array.isArray(body.actors) ? body.actors : [];
    const audience = Array.isArray(body.audience) ? body.audience : [];
    const since = body.since || {};
    const limit = Math.min(Number(body.limit) || 100, 500); // max 500
    const includePublic = body.includePublic !== false;

    // Build query for FeedCache
    const query = {
      origin: "local", // Only return our local content
      deletedAt: null, // Not deleted
    };

    // Collect items from different scopes
    const allItems = [];

    // Scope: public posts (if requested)
    if (includePublic) {
      const publicQuery = {
        ...query,
        to: "public",
      };

      if (since.public) {
        publicQuery.publishedAt = { $gt: new Date(since.public) };
      }

      const publicItems = await FeedCache.find(publicQuery)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .select("id url actorId objectType type publishedAt object to canReply canReact")
        .lean();

      allItems.push(...publicItems);
    }

    // Scope: specific actors on our server
    if (actors.length > 0) {
      // Filter actors to only those on our domain
      const localActors = actors.filter((actorId) => {
        const actorDomain = actorId.split("@").pop();
        return normalizeDomain(actorDomain) === normalizeDomain(ourDomain);
      });

      if (localActors.length > 0) {
        const actorsQuery = {
          ...query,
          actorId: { $in: localActors },
        };

        if (since.actors) {
          actorsQuery.publishedAt = { $gt: new Date(since.actors) };
        }

        const actorItems = await FeedCache.find(actorsQuery)
          .sort({ publishedAt: -1 })
          .limit(limit)
          .select("id url actorId objectType type publishedAt object to canReply canReact")
          .lean();

        allItems.push(...actorItems);
      }
    }

    // Scope: posts addressed to specific users on the requesting server
    if (audience.length > 0) {
      // Find items where any of the audience members are in the item's audience
      const audienceQuery = {
        ...query,
        $or: [
          { "object.to": { $in: audience } },
          { "object.cc": { $in: audience } },
          { "object.audience": { $in: audience } },
        ],
      };

      if (since.audience) {
        audienceQuery.publishedAt = { $gt: new Date(since.audience) };
      }

      const audienceItems = await FeedCache.find(audienceQuery)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .select("id url actorId objectType type publishedAt object to canReply canReact")
        .lean();

      allItems.push(...audienceItems);
    }

    // Deduplicate and sort items
    const itemsMap = new Map();
    for (const item of allItems) {
      if (!itemsMap.has(item.id)) {
        itemsMap.set(item.id, item);
      }
    }

    const items = Array.from(itemsMap.values())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);

    // Compute next cursors based on latest item in each scope
    const cursors = {};

    if (items.length > 0) {
      // Use the latest publishedAt as cursor for each scope
      const latestPublishedAt = items[0].publishedAt.toISOString();

      if (includePublic) cursors.public = latestPublishedAt;
      if (actors.length > 0) cursors.actors = latestPublishedAt;
      if (audience.length > 0) cursors.audience = latestPublishedAt;
    }

    // Return response
    setStatus(200);
    set("type", "OrderedCollection");
    set("items", items);
    if (Object.keys(cursors).length > 0) {
      set("cursors", cursors);
    }
    set("total", items.length);
    set("requestedBy", requestingDomain);
  },
  { allowUnauth: true } // Server-to-server endpoint - authenticates via JWT, not user session
);
