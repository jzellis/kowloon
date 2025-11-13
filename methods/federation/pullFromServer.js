// /methods/federation/pullFromServer.js
// Pull content from a remote server

import { Server, FeedCache, User, Circle } from "#schema";
import buildAudienceForPull from "#methods/federation/buildAudienceForPull.js";
import signPullJwt from "#methods/federation/signPullJwt.js";
import enqueueFeedFanOut from "#methods/feed/enqueueFanOut.js";
import {
  computeFiltersHash,
  computeActorsSetHash,
  computeAudienceSetHash,
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
    .replace(/^@/, "")
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

/**
 * Pull content from a remote server
 *
 * @param {string} domain - Remote server domain (e.g., "kwln.social")
 * @param {Object} options - Pull options
 * @param {number} [options.limit] - Max items to pull (default: 100)
 * @param {Object} [options.filters] - Content filters
 * @returns {Promise<Object>} Result with ingested count, status, etc.
 */
export default async function pullFromServer(domain, options = {}) {
  domain = normalizeDomain(domain);

  // Get our domain from settings
  const { getServerSettings } = await import("#methods/settings/schemaHelpers.js");
  const { domain: ourDomain } = getServerSettings();

  // Find Server record
  let server = await Server.findOne({ domain });

  if (!server) {
    console.log(`Pull: Server ${domain} not found in registry`);
    return {
      error: `Server ${domain} not found in registry`,
      status: 404,
    };
  }

  console.log(`Pull: Starting pull from ${domain}, include:`, server.include);

  // Check moderation status
  if (server.status === "blocked") {
    return {
      error: `Server ${domain} is blocked`,
      status: 403,
    };
  }

  // Parse options
  const requestLimit = options.limit || 100;
  const filters = normalizeFilters(options.filters || {});

  // Compute filters hash
  const filtersHash = computeFiltersHash(filters);

  // Determine include scopes
  const include = [];
  if (server.include.public) include.push("public");
  if (server.include.actors) include.push("actors");
  if (server.include.audience) include.push("audience");

  if (include.length === 0) {
    return {
      domain,
      requested: { include: [], counts: {} },
      result: { status: "skipped", ingested: 0 },
      next: {},
    };
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

  // Build request body with simpler structure
  const requestBody = {
    requestingServer: `@${ourDomain}`,
    actors: actors,
    audience: audience,
    since: since,
    limit: Math.min(requestLimit, server.maxPage || 200),
    includePublic: include.includes("public"),
  };

  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": `Kowloon/1.0`,
  };

  // Add JWT if signedPull is supported
  if (server.supports.signedPull) {
    try {
      const jwt = await signPullJwt({ aud: `https://${domain}` });
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
  const pullUrl = server.pullEndpoint || `https://${domain}/federation/pull`;

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

    return {
      error: `Failed to connect to ${domain}`,
      details: err.message,
      status: 502,
    };
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

    return {
      domain,
      requested: {
        include,
        counts: { actors: actors.length, audience: audience.length },
        limit: requestBody.limit,
      },
      result: { status: 304, ingested: 0 },
      next: { cursorsPresent: Object.keys(since) },
    };
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

    return {
      error: `Remote server returned ${response.status}`,
      details: errorText,
      status: response.status,
    };
  }

  // Parse 200 response
  let responseData;
  try {
    responseData = await response.json();
  } catch (err) {
    return {
      error: "Failed to parse response from remote server",
      status: 502,
    };
  }

  // Validate response structure
  if (responseData.type !== "OrderedCollection" && !Array.isArray(responseData.items)) {
    return {
      error: "Invalid response structure from remote server",
      status: 502,
    };
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
  return {
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
  };
}
