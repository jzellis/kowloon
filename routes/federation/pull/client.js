// /routes/federation/pull/client.js
// CLIENT route: POST /federation/pull/:domain
// Our server A calls remote server B's /outbox/pull endpoint

import route from "../../utils/route.js";
import { Server, FeedCache, User, Circle } from "#schema";
import buildAudienceForPull from "#methods/federation/buildAudienceForPull.js";
import signPullJwt from "#methods/federation/signPullJwt.js";
import enqueueFeedFanOut from "#methods/feed/enqueueFanOut.js";
import {
  computeFiltersHash,
  computeActorsSetHash,
  computeAudienceSetHash,
  getOrInitCursor,
  normalizeFilters,
} from "#methods/federation/cursorUtils.js";
import fetch from "node-fetch";

/**
 * Normalize domain to lowercase, remove scheme/port
 */
function normalizeDomain(domain) {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/:\d+$/, "");
}

/**
 * Ingest items from pull response into FeedCache
 */
async function ingestItems(items = [], serverDomain) {
  const ingested = [];

  for (const item of items) {
    if (!item.id || !item.actorId || !item.type) {
      console.warn("Skipping invalid item:", item);
      continue;
    }

    try {
      // Sanitize object: remove visibility, deletion, source, and MongoDB internal fields
      // These will be stored at FeedCache top-level (visibility) or not at all (internal/metadata)
      const sanitizedObject = { ...item };
      delete sanitizedObject.to;
      delete sanitizedObject.canReply;
      delete sanitizedObject.canReact;
      delete sanitizedObject.deletedAt;
      delete sanitizedObject.deletedBy;
      delete sanitizedObject.source;
      delete sanitizedObject._id;
      delete sanitizedObject.__v;

      // Normalize visibility values
      const normalizeTo = (val) => {
        if (!val) return "public";
        const v = String(val).toLowerCase().trim();
        if (v === "@public" || v === "public") return "public";
        return v === "server" ? "server" : "audience";
      };

      const normalizeCap = (val) => {
        if (!val) return "public";
        const v = String(val).toLowerCase().trim();
        return ["public", "followers", "audience", "none"].includes(v) ? v : "public";
      };

      // Upsert into FeedCache
      const cached = await FeedCache.findOneAndUpdate(
        { id: item.id },
        {
          $setOnInsert: {
            id: item.id,
            url: item.url || item.id,
            origin: "remote",
            originDomain: serverDomain,
            actorId: item.actorId,
            objectType: item.objectType || "Post",
            type: item.type,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
            object: sanitizedObject,
          },
          $set: {
            to: normalizeTo(item.to),
            canReply: normalizeCap(item.canReply),
            canReact: normalizeCap(item.canReact),
            lastSyncedAt: new Date(),
            etag: item.etag || undefined,
          },
        },
        { upsert: true, new: true }
      );

      ingested.push(cached);
    } catch (err) {
      console.error(`Failed to ingest item ${item.id}:`, err.message);
    }
  }

  return ingested;
}

/**
 * Fan out items to local user feeds based on scope
 */
async function fanOutItems(items, scope, metadata = {}) {
  const { audience = [], actors = [], serverDomain } = metadata;

  for (const item of items) {
    try {
      let recipients = [];
      let reason = "domain";

      if (scope === "public") {
        // Recipients: locals who follow @serverB
        const circles = await Circle.find({
          subtype: "Following",
          "members.id": `@${serverDomain}`,
        }).select("owner.id");

        recipients = circles.map((c) => c.owner.id).filter(Boolean);
        reason = "domain";
      } else if (scope === "actors") {
        // Recipients: locals who follow this specific author
        const circles = await Circle.find({
          subtype: "Following",
          "members.id": item.actorId,
        }).select("owner.id");

        recipients = circles.map((c) => c.owner.id).filter(Boolean);
        reason = "follow";
      } else if (scope === "audience") {
        // Recipients: exactly the local users in our audience[]
        recipients = audience;
        reason = "audience";
      }

      // Enqueue fan-out job
      if (recipients.length > 0) {
        await enqueueFeedFanOut({
          feedCacheId: item.id,
          objectType: item.objectType || "Post",
          actorId: item.actorId,
          audience: {
            to: item.to || "public",
            canReply: item.canReply || "public",
            canReact: item.canReact || "public",
          },
        });
      }
    } catch (err) {
      console.error(`Fan-out failed for item ${item.id}:`, err.message);
    }
  }
}

export default route(
  async (api) => {
    const { params, body, set, setStatus } = api;

    // Extract and normalize domain
    let domain = params.domain;
    if (!domain) {
      setStatus(400);
      set({ error: "Missing domain parameter" });
      return;
    }

    domain = normalizeDomain(domain);

    // Parse body options
    const requestLimit = body.limit || 100;
    const filters = normalizeFilters(body.filters);

    // Find Server record
    let server = await Server.findOne({ domain });

    if (!server) {
      setStatus(404);
      set({ error: `Server ${domain} not found in registry` });
      return;
    }

    // Check moderation status
    if (server.status === "blocked") {
      setStatus(403);
      set({ error: `Server ${domain} is blocked` });
      return;
    }

    // Compute filters hash
    const filtersHash = computeFiltersHash(filters);

    // Determine include scopes
    const include = [];
    if (server.include.public) include.push("public");
    if (server.include.actors) include.push("actors");
    if (server.include.audience) include.push("audience");

    if (include.length === 0) {
      setStatus(200);
      set({
        domain,
        requested: { include: [], counts: {} },
        result: { status: "skipped", ingested: 0 },
        next: {},
      });
      return;
    }

    // Build actors list (REMOTE actor IDs)
    const actors = server.actorsRefCount
      ? Array.from(server.actorsRefCount.keys())
      : [];

    // Build audience list (LOCAL user IDs)
    let audience = [];
    if (include.includes("audience") && actors.length > 0) {
      audience = await buildAudienceForPull({
        domain,
        actors,
        maxAudience: 5000,
      });
    }

    // Compute set hashes
    const actorsSetHash = computeActorsSetHash(actors, filtersHash);
    const audienceSetHash = computeAudienceSetHash(audience, filtersHash);

    // Get cursors
    const since = {};
    if (server.cursors?.public?.cursor) {
      since.public = server.cursors.public.cursor;
    }
    if (server.cursors?.actors) {
      const actorsCursor = server.cursors.actors.get(actorsSetHash);
      if (actorsCursor?.cursor) {
        since.actors = actorsCursor.cursor;
      }
    }
    if (server.cursors?.audience) {
      const audienceCursor = server.cursors.audience.get(audienceSetHash);
      if (audienceCursor?.cursor) {
        since.audience = audienceCursor.cursor;
      }
    }

    // Build request body
    const requestBody = {
      include,
      limit: Math.min(requestLimit, server.maxPage || 200),
    };

    if (actors.length > 0 && include.includes("actors")) {
      requestBody.actors = actors;
    }

    if (audience.length > 0 && include.includes("audience")) {
      requestBody.audience = audience;
    }

    if (Object.keys(since).length > 0) {
      requestBody.since = since;
    }

    if (Object.keys(filters).length > 0) {
      requestBody.filters = filters;
    }

    requestBody.capabilities = { includeGrants: true };

    // Prepare headers
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": `Kowloon/1.0`,
    };

    // Add JWT if signedPull is supported
    if (server.supports.signedPull) {
      try {
        const jwt = await signPullJwt({ aud: domain });
        headers["Authorization"] = `Bearer ${jwt}`;
      } catch (err) {
        console.error(`Failed to sign JWT for ${domain}:`, err.message);
      }
    }

    // Add If-None-Match if we have an etag
    if (server.cursors?.public?.etag) {
      headers["If-None-Match"] = server.cursors.public.etag;
    }

    // Add Accept-Encoding
    if (server.supports.compression && server.acceptEncodings?.length > 0) {
      headers["Accept-Encoding"] = server.acceptEncodings.join(", ");
    }

    // Make HTTP request to remote server
    const pullUrl = server.outbox || `https://${domain}/outbox/pull`;

    let response;
    try {
      response = await fetch(pullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        timeout: server.timeouts?.readMs || 30000,
      });
    } catch (err) {
      // Handle network errors
      console.error(`Pull request to ${domain} failed:`, err.message);

      await Server.updateOne(
        { domain },
        {
          $inc: { "scheduler.errorCount": 1 },
          $set: {
            "scheduler.lastError": err.message,
            "scheduler.lastErrorCode": "ECONN",
            "scheduler.backoffMs": Math.min(
              (server.scheduler?.backoffMs || 0) + 60000,
              3600000
            ), // max 1 hour
          },
        }
      );

      setStatus(502);
      set({ error: `Failed to connect to ${domain}`, details: err.message });
      return;
    }

    // Handle 304 Not Modified
    if (response.status === 304) {
      await Server.updateOne(
        { domain },
        {
          $inc: {
            "stats.notModifiedHits": 1,
            "stats.consecutiveNotModified": 1,
          },
          $set: {
            "scheduler.lastSuccessfulPollAt": new Date(),
            "scheduler.errorCount": 0,
            "scheduler.backoffMs": 0,
            "scheduler.nextPollAt": new Date(Date.now() + 300000), // 5 min
          },
        }
      );

      setStatus(200);
      set({
        domain,
        requested: {
          include,
          counts: { actors: actors.length, audience: audience.length },
          limit: requestBody.limit,
        },
        result: { status: 304, ingested: 0 },
        next: { cursorsPresent: Object.keys(since) },
      });
      return;
    }

    // Handle non-200 responses
    if (response.status !== 200) {
      const errorText = await response.text().catch(() => "");

      await Server.updateOne(
        { domain },
        {
          $inc: { "scheduler.errorCount": 1 },
          $set: {
            "scheduler.lastError": `HTTP ${response.status}`,
            "scheduler.lastErrorCode": "EHTTP",
            "scheduler.backoffMs": Math.min(
              (server.scheduler?.backoffMs || 0) + 60000,
              3600000
            ),
          },
        }
      );

      setStatus(response.status);
      set({ error: `Remote server returned ${response.status}`, details: errorText });
      return;
    }

    // Parse 200 response
    let responseData;
    try {
      responseData = await response.json();
    } catch (err) {
      setStatus(502);
      set({ error: "Failed to parse response from remote server" });
      return;
    }

    // Validate response structure
    if (responseData.type !== "OrderedCollection" && !Array.isArray(responseData.items)) {
      setStatus(502);
      set({ error: "Invalid response structure from remote server" });
      return;
    }

    const items = responseData.items || [];

    // Apply content filters
    let filteredItems = items;
    if (server.contentFilters?.rejectObjectTypes?.length > 0) {
      filteredItems = filteredItems.filter(
        (item) => !server.contentFilters.rejectObjectTypes.includes(item.objectType)
      );
    }
    if (server.contentFilters?.rejectPostTypes?.length > 0) {
      filteredItems = filteredItems.filter(
        (item) => !server.contentFilters.rejectPostTypes.includes(item.type)
      );
    }

    // Ingest items into FeedCache
    const ingested = await ingestItems(filteredItems, domain);

    // Fan out to local feeds (enqueue, don't block)
    setImmediate(async () => {
      try {
        if (include.includes("public")) {
          await fanOutItems(
            ingested.filter((i) => i.to === "public"),
            "public",
            { serverDomain: domain }
          );
        }
        if (include.includes("actors")) {
          await fanOutItems(
            ingested.filter((i) => actors.includes(i.actorId)),
            "actors",
            { actors, serverDomain: domain }
          );
        }
        if (include.includes("audience")) {
          await fanOutItems(ingested, "audience", { audience, serverDomain: domain });
        }
      } catch (err) {
        console.error(`Fan-out error for ${domain}:`, err.message);
      }
    });

    // Update Server cursors
    const updates = {
      $set: {
        "scheduler.lastSuccessfulPollAt": new Date(),
        "scheduler.errorCount": 0,
        "scheduler.backoffMs": 0,
        "scheduler.nextPollAt": new Date(Date.now() + 300000), // 5 min (adjust as needed)
        "stats.consecutiveNotModified": 0,
      },
      $inc: {
        "stats.itemsSeen": ingested.length,
      },
    };

    if (ingested.length > 0) {
      const latestPublishedAt = ingested.reduce(
        (max, item) => (item.publishedAt > max ? item.publishedAt : max),
        new Date(0)
      );
      updates.$set["stats.lastItemAt"] = latestPublishedAt;
    }

    // Update public cursor
    if (responseData.cursors?.public) {
      updates.$set["cursors.public.cursor"] = responseData.cursors.public;
      updates.$set["cursors.public.updatedAt"] = new Date();
      if (response.headers.get("etag")) {
        updates.$set["cursors.public.etag"] = response.headers.get("etag");
      }
    }

    // Update actors cursor
    if (responseData.cursors?.actors) {
      server.cursors = server.cursors || {};
      server.cursors.actors = server.cursors.actors || new Map();

      server.cursors.actors.set(actorsSetHash, {
        cursor: responseData.cursors.actors,
        etag: response.headers.get("etag"),
        filtersHash,
        actors,
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      });

      updates.$set["cursors.actors"] = server.cursors.actors;
    }

    // Update audience cursor
    if (responseData.cursors?.audience) {
      server.cursors = server.cursors || {};
      server.cursors.audience = server.cursors.audience || new Map();

      server.cursors.audience.set(audienceSetHash, {
        cursor: responseData.cursors.audience,
        etag: response.headers.get("etag"),
        filtersHash,
        audience: undefined, // NEVER store audience list permanently
        updatedAt: new Date(),
        lastUsedAt: new Date(),
      });

      updates.$set["cursors.audience"] = server.cursors.audience;
    }

    await Server.updateOne({ domain }, updates);

    // Return success response
    setStatus(200);
    set({
      domain,
      requested: {
        include,
        counts: { actors: actors.length, audience: audience.length },
        limit: requestBody.limit,
      },
      result: {
        status: 200,
        ingested: ingested.length,
        filtered: items.length - filteredItems.length,
      },
      next: {
        cursorsPresent: [
          responseData.cursors?.public && "public",
          responseData.cursors?.actors && "actors",
          responseData.cursors?.audience && "audience",
        ].filter(Boolean),
      },
    });
  },
  { allowUnauth: false } // Require authentication
);
