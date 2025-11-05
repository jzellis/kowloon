# Federation Pull Routes

This directory contains both server and client implementations for the `/outbox/pull` federation protocol.

## Routes

### 1. Server Route: `POST /federation/pull`
**File:** `post.js`

Receives pull requests FROM remote servers requesting content from this server.

**Request body:**
```json
{
  "viewer": "@alice@remote.server",
  "members": ["@user1@our.server", "@user2@our.server"],
  "since": "cursor-or-timestamp",
  "limit": 100
}
```

**Response:**
```json
{
  "items": [...],
  "next": "next-cursor"
}
```

---

### 2. Client Route: `POST /federation/pull/:domain`
**File:** `client.js`

Makes pull requests TO remote servers to fetch content for local users.

**Path parameter:**
- `domain` - Remote server domain (e.g., `remote.example.com`)

**Request body (optional):**
```json
{
  "limit": 100,
  "filters": {
    "objectTypes": ["Post", "Reply"],
    "postTypes": ["Note", "Article"]
  }
}
```

**Response:**
```json
{
  "domain": "remote.example.com",
  "requested": {
    "include": ["public", "actors", "audience"],
    "counts": {
      "actors": 5,
      "audience": 10
    },
    "limit": 100
  },
  "result": {
    "status": 200,
    "ingested": 25,
    "filtered": 2
  },
  "next": {
    "cursorsPresent": ["public", "actors", "audience"]
  }
}
```

## Client Route Details

### How it Works

1. **Load Server Record**
   - Looks up the `Server` document for the target domain
   - Checks moderation status (blocked servers are rejected)
   - Reads configuration: `include`, `actorsRefCount`, `serverFollowersCount`, `cursors`

2. **Build Request**
   - **Include scopes**: Determined from `server.include.{public,actors,audience}`
   - **Actors list** (REMOTE): Extracted from `server.actorsRefCount.keys()`
   - **Audience list** (LOCAL): Built on-the-fly using `buildAudienceForPull()` helper
     - Queries local Following circles to find users who follow the remote actors
     - Caps at 5000 users (configurable)
     - Sorted for consistent hashing
   - **Cursors**: Retrieved from `server.cursors.{public,actors,audience}` Maps
   - **Filters**: Normalized and hashed for cursor key generation

3. **Make HTTP Request**
   - URL: `server.outbox` or `https://{domain}/outbox/pull`
   - Method: POST
   - Headers:
     - `Authorization: Bearer <JWT>` (if `server.supports.signedPull`)
     - `If-None-Match: <etag>` (if available)
     - `Accept-Encoding` (if compression supported)
   - Body: `{ include, actors, audience, since, limit, filters, capabilities }`
   - Timeout: `server.timeouts.readMs` (default 30s)

4. **Handle Response**
   - **304 Not Modified**: Updates stats, resets backoff, schedules next poll
   - **200 OK**: Ingests items, fans out to local feeds, updates cursors
   - **Errors**: Increments error count, applies exponential backoff

5. **Ingest Items**
   - Upserts into `FeedCache` by `id` (de-duplication)
   - Sets `origin: "remote"`, `originDomain`, `to`, `canReply`, `canReact`
   - Applies content filters from `server.contentFilters`
   - Never stores circle IDs

6. **Fan Out**
   - Enqueues `FeedFanOut` jobs (async, non-blocking)
   - **Public scope**: Recipients = locals following `@domain`
   - **Actors scope**: Recipients = locals following the specific author
   - **Audience scope**: Recipients = exactly the audience list we sent
   - Jobs are processed by `/workers/feedFanOut.js`

7. **Update Cursors**
   - **Public cursor**: `server.cursors.public.{cursor, etag}`
   - **Actors cursor**: `server.cursors.actors[actorsSetHash].{cursor, etag, filtersHash, actors}`
   - **Audience cursor**: `server.cursors.audience[audienceSetHash].{cursor, etag, filtersHash}`
   - Note: Audience members are NOT stored in cursor (privacy)

8. **Update Scheduler**
   - Resets `scheduler.errorCount` and `scheduler.backoffMs`
   - Sets `scheduler.nextPollAt` (e.g., 5 minutes from now)
   - Increments `stats.itemsSeen`
   - Updates `stats.lastItemAt`

### Cursor Hashing

Cursors are keyed by set hashes to handle dynamic audiences:

```javascript
filtersHash = sha256(JSON.stringify(normalizedFilters))
actorsSetHash = sha256(JSON.stringify(actors.sort())) + ":" + filtersHash
audienceSetHash = sha256(JSON.stringify(audience.sort())) + ":" + filtersHash
```

This means:
- Different actor sets get different cursor buckets
- Different audiences get different cursor buckets
- Filter changes invalidate cursors (forces fresh pull)

### Privacy Invariants

✅ **Never stored:**
- Circle IDs
- Raw audience lists (only hash → cursor mapping)
- Remote user lists (only refcounts)

✅ **Stored:**
- `actorsRefCount`: Map of remote actor ID → count
- `serverFollowersCount`: Count of locals following `@domain`
- Audience set hash (opaque)

### Authentication

If `server.supports.signedPull` is true, the route signs a JWT:

```javascript
{
  iss: "https://our-server.com",
  aud: "remote-server.com",
  sub: "https://our-server.com/@server",
  scope: "outbox:pull",
  iat: now,
  exp: now + 60
}
```

Algorithm: RS256 (using server's private key)

### Error Handling

| Error | Action |
|-------|--------|
| Network failure (ECONN) | Increment errorCount, apply backoff |
| Timeout (ETIMEOUT) | Increment errorCount, apply backoff |
| HTTP 4xx/5xx | Log error code, apply backoff |
| Invalid response | Return 502 to caller |
| Content filter match | Skip item, don't ingest |

Backoff formula: `min(currentBackoff + 60s, 1 hour)`

### Moderation

- **Blocked servers**: 403 Forbidden (no request sent)
- **Limited servers**: Request sent, but could filter results
- **Content filters**: Applied post-ingestion
  - `contentFilters.rejectObjectTypes`: Filter by objectType
  - `contentFilters.rejectPostTypes`: Filter by type

## Helper Modules

### `buildAudienceForPull.js`
Builds the LOCAL audience list for a pull request.

**Logic:**
1. Find all local Following circles containing any of the `actors`
2. Add users who follow `@domain` (server follow)
3. De-duplicate, sort, cap at maxAudience (default 5000)

**Never stores audience permanently** - rebuilt on every pull.

### `cursorUtils.js`
Utilities for cursor management:
- `sha256(data)` - Hash helper
- `normalizeFilters(filters)` - Sort keys/values for consistent hashing
- `computeFiltersHash(filters)` - Hash normalized filters
- `computeActorsSetHash(actors, filtersHash)` - Generate actors cursor key
- `computeAudienceSetHash(audience, filtersHash)` - Generate audience cursor key
- `getOrInitCursor(map, key, metadata)` - Get or create cursor entry

### `signPullJwt.js`
Signs a short-lived JWT for authenticated pull requests.

**Parameters:**
- `aud` - Remote domain
- `scope` - Default "outbox:pull"
- `expiresIn` - Default 60 seconds

Uses RS256 with server's private key.

## Usage Example

### Via API Call

```javascript
import fetch from "node-fetch";

const response = await fetch("https://our-server.com/federation/pull/remote.example.com", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_JWT_TOKEN"
  },
  body: JSON.stringify({
    limit: 50,
    filters: {
      objectTypes: ["Post", "Reply"]
    }
  })
});

const result = await response.json();
console.log(result);
```

### Via Scheduled Job

```javascript
import { Server } from "./schema/index.js";
import fetch from "node-fetch";

async function pollRemoteServers() {
  const now = new Date();

  // Find servers due for polling
  const servers = await Server.find({
    status: { $nin: ["blocked"] },
    "scheduler.nextPollAt": { $lte: now }
  }).limit(10);

  for (const server of servers) {
    try {
      // Make authenticated request to our own client endpoint
      await fetch(`http://localhost:3000/federation/pull/${server.domain}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SYSTEM_JWT}`
        },
        body: JSON.stringify({ limit: 100 })
      });
    } catch (err) {
      console.error(`Failed to poll ${server.domain}:`, err);
    }
  }
}

// Run every 5 minutes
setInterval(pollRemoteServers, 5 * 60 * 1000);
```

## Testing

See `/tests/test-pull-client.js` for a complete test script.

**Run test:**
```bash
TEST_JWT_TOKEN=your_token node tests/test-pull-client.js
```

## Architecture Decisions

### Why not store audience in Server?

**Privacy**: Storing lists of local users per remote domain creates unnecessary PII exposure.

**Scale**: Audience lists can grow large (thousands of users × hundreds of servers).

**Freshness**: Follows/unfollows would require updating audience lists constantly.

**Solution**: Build audience on-demand, store only the hash → cursor mapping.

### Why use reference counts?

**Privacy**: Track *what* is followed, not *who* follows it.

**Efficiency**: Small Map (dozens of actors) vs large arrays (thousands of users).

**Simplicity**: `actorsRefCount.size > 0` tells us everything we need for `include.actors`.

### Why separate cursors per set hash?

**Correctness**: Different actor sets have different cursor positions on the remote server.

**Flexibility**: Allows filters to change without corrupting cursor state.

**Performance**: Remote server can optimize responses per scope (public vs actors vs audience).

## Security

✅ **Authentication**: Requires JWT (checked by route wrapper)

✅ **Moderation**: Respects Server.status (blocked/limited)

✅ **Content filtering**: Applied before ingest

✅ **Timeout protection**: Requests timeout after 30s (configurable)

✅ **Rate limiting**: Per-server backoff on errors

✅ **Input validation**: Domain normalization, filter sanitization

❌ **Not implemented**: Per-domain mutex (concurrent pulls could race)

❌ **Not implemented**: Response size limits (could OOM on huge responses)

## Future Enhancements

- [ ] Add per-domain mutex to prevent concurrent pulls
- [ ] Add response size limits
- [ ] Add retry with jitter for transient errors
- [ ] Add telemetry/metrics (pull duration, item counts, error rates)
- [ ] Add per-domain rate limiting (requests per minute)
- [ ] Add compression support validation
- [ ] Add ETag aggregation across scopes
- [ ] Add support for capability grants/tokens from response
- [ ] Add cursor GC (remove stale cursor entries after N days)
