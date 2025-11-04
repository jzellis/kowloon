# Feed Fan-Out System

This document describes the asynchronous feed fan-out system for Kowloon.

## Architecture Overview

The feed system uses a **two-tier approach** for efficient timeline delivery:

1. **FeedCache** - Global canonical storage for all objects that can appear in feeds
2. **Feed** - Per-viewer fan-out rows with pre-computed permissions

```
User creates Post
     ↓
ActivityParser Create Handler
     ↓
Post Collection (source of truth)
     ↓
FeedCache (normalized envelope) ← You are here
     ↓
FeedFanOut Queue (job enqueued)
     ↓
Background Worker processes job
     ↓
Feed Collection (per-viewer entries)
     ↓
User requests timeline → reads Feed
```

## Components

### 1. FeedCache (schema/FeedCache.js)
Global object storage for timeline-eligible content:
- Canonical `id` and `url` for federation
- Global audience policies (`to`, `canReply`, `canReact`)
- Full object envelope for detail views
- Origin tracking (local/remote)

### 2. Feed (schema/Feed.js)
Per-viewer fan-out table:
- `actorId` (viewer) + `objectId` (→ FeedCache.id)
- `reason` why it's in the feed: "follow" | "domain" | "audience" | "mention" | "self"
- Per-viewer capabilities: `canReply` and `canReact` (booleans)
- Optional `snapshot` for list rendering

### 3. FeedFanOut (schema/FeedFanOut.js)
Queue for async processing:
- Tracks pending, processing, completed, and failed jobs
- Retry logic with exponential backoff
- Deduplication to prevent duplicate fan-outs

### 4. Fan-Out Worker (workers/feedFanOut.js)
Background process that:
- Polls for pending jobs every 5 seconds
- Computes audience for each FeedCache entry
- Creates Feed entries for relevant viewers
- Retries failed jobs with backoff

## Audience Resolution

When an object is created, the worker determines who should see it:

### Delivery Rules (who gets a Feed entry)
- **Self** → Creator themselves (reason: "self") - only for local authors
- **Followers** → Users who follow the creator (reason: "follow")
- **"@public"** → Users who follow @server (reason: "domain") - NOT all local users
- **Audience members** → Users in Circle/Group/Event specified in `to` (reason: "audience") - LOCAL content only

### Capability Computation (canReply/canReact booleans)

The unified `hasCapability()` function handles all capability checks:

- **"public"** → always `true`
- **"none"** → always `false`
- **"followers"** → `true` if viewer follows author
- **"audience"** → depends on origin:
  - **Local content**: `true` if viewer is member of addressed Circle/Group/Event
  - **Remote content**: `true` if viewer has grant/token (never resolves remote circles)

### Important Design Decisions

1. **Public posts don't fan out to ALL local users** - only to users who follow @server
   - Prevents spam from remote instances
   - Users must explicitly follow @server to see public posts

2. **Remote circles are NEVER resolved** - only use grants/tokens
   - Privacy: we can't verify membership in remote circles
   - Performance: avoid fetching remote circle data

3. **Addressed IDs are LOCAL only** - extracted and stored in job
   - Worker uses these for membership checks
   - Remote circle IDs are ignored

4. **Batch operations for performance**
   - `buildFollowerMap()`: Load all followings in one query
   - `buildMembershipMap()`: Batch fetch circles/groups/events
   - Minimizes database queries per job

## Running the Worker

### Development
```bash
npm run worker:feed
```

### Production
Use a process manager like PM2:
```bash
pm2 start workers/feedFanOut.js --name "feed-worker"
pm2 save
```

Or systemd:
```ini
[Unit]
Description=Kowloon Feed Fan-Out Worker

[Service]
Type=simple
WorkingDirectory=/path/to/kowloon
ExecStart=/usr/bin/node workers/feedFanOut.js
Restart=always
Environment=NODE_ENV=production
Environment=MONGO_URI=mongodb://localhost:27017/kowloon

[Install]
WantedBy=multi-user.target
```

## Configuration

Environment variables:
- `MONGO_URI` - MongoDB connection string (default: mongodb://localhost:27017/kowloon)
- `POLL_INTERVAL_MS` - How often to poll for jobs (default: 5000ms)
- `BATCH_SIZE` - Max jobs per batch (default: 10)

## Monitoring

Check job status:
```javascript
// Pending jobs
db.feedfanouts.find({ status: "pending" }).count()

// Failed jobs
db.feedfanouts.find({ status: "failed" })

// Recent completions
db.feedfanouts.find({ status: "completed" }).sort({ completedAt: -1 }).limit(10)
```

Check feed entries:
```javascript
// Entries for a specific user
db.feeds.find({ actorId: "@alice@kwln.org" }).count()

// Entries by reason
db.feeds.aggregate([
  { $group: { _id: "$reason", count: { $sum: 1 } } }
])
```

## Performance Considerations

### Write Amplification
Each post creates N Feed entries (where N = number of viewers). For popular accounts:
- 100 followers → ~100 Feed writes
- 10,000 followers → ~10,000 Feed writes

This is acceptable because:
- Writes happen async (doesn't block user request)
- Reads are O(1) per viewer (just query their Feed entries)
- Trade-off favors read performance (timeline queries are frequent)

### Optimization Strategies
1. **Batch inserts**: Worker uses `bulkWrite` for efficiency
2. **Skip inactive users**: Only fan-out to users who logged in recently
3. **Pagination**: Worker processes jobs in batches
4. **Retry logic**: Failed jobs retry with exponential backoff

## Debugging

Enable debug logging:
```bash
DEBUG=feed:* npm run worker:feed
```

Manually trigger fan-out for a FeedCache entry:
```javascript
import enqueueFeedFanOut from "#methods/feed/enqueueFanOut.js";

await enqueueFeedFanOut({
  feedCacheId: "post:abc123@kwln.org",
  objectType: "Post",
  actorId: "@alice@kwln.org",
  audience: { to: "@public", canReply: "@public", canReact: "@public" }
});
```

## Future Improvements

- [ ] Priority queue for popular accounts
- [ ] Horizontal scaling with multiple workers
- [ ] Skip fan-out for inactive users (login < 30 days)
- [ ] Fan-out sampling for very large audiences (>50k)
- [ ] Real-time notifications via WebSocket
- [ ] Metrics/monitoring dashboard
