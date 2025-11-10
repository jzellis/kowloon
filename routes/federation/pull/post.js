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
    const { body, headers, setStatus, set } = api;

    // Get our domain for JWT verification
    const { domain: ourDomain } = getServerSettings();

    // Extract and verify JWT
    let requestingDomain;
    const authHeader = headers.authorization || headers.Authorization;

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
    const include = Array.isArray(body.include) ? body.include : [];
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
    const results = {
      public: [],
      actors: [],
      audience: [],
    };

    // Scope: public
    if ((include.includes("public") || includePublic) && since.public !== undefined) {
      const publicQuery = {
        ...query,
        to: "public",
      };

      if (since.public) {
        publicQuery.publishedAt = { $gt: new Date(since.public) };
      }

      results.public = await FeedCache.find(publicQuery)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .select("id url actorId objectType type publishedAt object to canReply canReact")
        .lean();
    }

    // Scope: actors
    if (include.includes("actors") && actors.length > 0) {
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

        results.actors = await FeedCache.find(actorsQuery)
          .sort({ publishedAt: -1 })
          .limit(limit)
          .select("id url actorId objectType type publishedAt object to canReply canReact")
          .lean();
      }
    }

    // Scope: audience
    if (include.includes("audience") && audience.length > 0) {
      // Find items where any of the audience members are in the item's audience
      // This requires checking the object.to array or audience fields
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

      results.audience = await FeedCache.find(audienceQuery)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .select("id url actorId objectType type publishedAt object to canReply canReact")
        .lean();
    }

    // Merge and deduplicate items
    const itemsMap = new Map();

    for (const scope of ["public", "actors", "audience"]) {
      for (const item of results[scope]) {
        if (!itemsMap.has(item.id)) {
          itemsMap.set(item.id, item);
        }
      }
    }

    const items = Array.from(itemsMap.values())
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, limit);

    // Compute next cursors
    const cursors = {};

    if (results.public.length > 0) {
      const latest = results.public[0];
      cursors.public = latest.publishedAt.toISOString();
    }

    if (results.actors.length > 0) {
      const latest = results.actors[0];
      cursors.actors = latest.publishedAt.toISOString();
    }

    if (results.audience.length > 0) {
      const latest = results.audience[0];
      cursors.audience = latest.publishedAt.toISOString();
    }

    // Return response
    setStatus(200);
    set({
      type: "OrderedCollection",
      items,
      cursors: Object.keys(cursors).length > 0 ? cursors : undefined,
      counts: {
        public: results.public.length,
        actors: results.actors.length,
        audience: results.audience.length,
        total: items.length,
      },
    });
  },
  { allowUnauth: false } // Require authentication
);
