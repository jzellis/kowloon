# Federation Push Worker

## Overview

The federation push worker runs in the background, processing outbound federation deliveries. When local users create activities that interact with remote resources (replies to remote posts, posts to remote groups, etc.), those activities are queued in the Outbox collection and this worker delivers them to remote servers.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  BACKGROUND PROCESS                          │
└─────────────────────────────────────────────────────────────┘
                           │
                    Every 5 seconds (configurable)
                           │
              ┌────────────┴────────────┐
              │                         │
         Find Outbox Jobs          Find Due Deliveries
         (pending/partial)         (nextAttemptAt <= now)
              │                         │
              │              ┌───────────┴───────────┐
              │              │                       │
              │         Sign HTTP Request       Send to Remote
              │         (HTTP Signatures)        Inbox (POST)
              │              │                       │
              │              └───────────┬───────────┘
              │                          │
              └─────────────┬────────────┘
                            │
                     Handle Response
                 (Success/Retry/Skip)
                            │
                    Update Delivery Status
                  (delivered/failed/pending)
```

## Worker Logic

### 1. Job Selection

Every poll interval, the worker:
1. Queries `Outbox` collection for jobs with pending/partial status
2. Filters by `counts.pending > 0`
3. Processes up to `BATCH_SIZE` jobs (default: 10)

### 2. Delivery Processing

For each job, the worker:
1. Finds deliveries where `status = 'pending'` and `nextAttemptAt <= now`
2. For each due delivery:
   - Signs HTTP request with server's private key (HTTP Signatures)
   - POSTs activity JSON to remote inbox URL
   - Records response status, headers, body, and metrics
   - Updates delivery status based on response

### 3. Response Handling

**Success (2xx):**
- Mark delivery as `delivered`
- Store response status, headers, body
- Extract `Location` header as `remoteActivityId`
- Clear `nextAttemptAt`

**Not Found (404/410):**
- Mark delivery as `skipped` (permanent failure)
- Recipient actor or inbox no longer exists
- No retry

**Client Error (4xx):**
- Quick retry once (5 seconds) for auth/clock skew issues
- If still failing after 2 attempts, mark as `failed`
- No further retries

**Server Error (5xx) or Network Error:**
- Retry with exponential backoff: 1s → 2s → 4s → 8s → 16s (max 1 hour)
- Max 5 attempts
- After max attempts, mark as `failed`

### 4. Job Status Updates

After processing deliveries, the Outbox pre-save hook recalculates:
- `counts.pending` - Deliveries still pending
- `counts.delivered` - Successfully delivered
- `counts.failed` - Permanently failed
- `counts.skipped` - Skipped (actor not found)
- `status` - Overall job status:
  - `pending` - All deliveries pending
  - `delivering` - Some deliveries in progress
  - `partial` - Some delivered, some pending/failed
  - `delivered` - All deliveries successful
  - `failed` - All deliveries failed/skipped

## Configuration

### Environment Variables

```bash
# Poll interval (default: 5000ms = 5 seconds)
OUTBOX_PUSH_INTERVAL_MS=5000

# MongoDB connection
MONGO_URI=mongodb://localhost:27017/kowloon
```

### Worker Configuration

In `/methods/federation/outboxWorker.js`:

```javascript
const CONFIG = {
  batchSize: 10,              // Process N jobs per tick
  maxAttempts: 5,             // Max retry attempts per delivery
  baseDelayMs: 1000,          // Base delay for exponential backoff (1s)
  maxDelayMs: 3600000,        // Max delay cap (1 hour)
  hostConcurrency: 2,         // Max concurrent deliveries per host (TODO)
  globalConcurrency: 10,      // Max total concurrent deliveries (TODO)
  responseBodyMaxBytes: 1024, // Max response body to store
};
```

## Running the Worker

### Development

```bash
node workers/outboxPush.js
```

### Production with PM2

```bash
pm2 start workers/outboxPush.js --name "outbox-push"
pm2 save
```

### Production with systemd

Create `/etc/systemd/system/kowloon-outbox-push.service`:

```ini
[Unit]
Description=Kowloon Outbox Push Worker
After=mongodb.service

[Service]
Type=simple
User=kowloon
WorkingDirectory=/path/to/kowloon
ExecStart=/usr/bin/node workers/outboxPush.js
Restart=always
Environment=NODE_ENV=production
Environment=MONGO_URI=mongodb://localhost:27017/kowloon
Environment=OUTBOX_PUSH_INTERVAL_MS=5000

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable kowloon-outbox-push
sudo systemctl start kowloon-outbox-push
sudo systemctl status kowloon-outbox-push
```

## Monitoring

### Check Worker Status

```bash
# With PM2
pm2 logs outbox-push

# With systemd
sudo journalctl -u kowloon-outbox-push -f
```

### Check Outbox Status

```javascript
// Jobs pending delivery
db.outboxes.find({
  status: { $in: ['pending', 'partial'] },
  'counts.pending': { $gt: 0 }
}).count()

// Recently delivered jobs
db.outboxes.find({
  status: 'delivered',
  lastAttemptedAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
}).sort({ lastAttemptedAt: -1 })

// Jobs with failures
db.outboxes.find({
  'counts.failed': { $gt: 0 }
}).sort({ 'counts.failed': -1 })

// Deliveries by status
db.outboxes.aggregate([
  { $unwind: '$deliveries' },
  { $group: { _id: '$deliveries.status', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

### Check Delivery Metrics

```javascript
// Average delivery latency
db.outboxes.aggregate([
  { $unwind: '$deliveries' },
  { $match: { 'deliveries.status': 'delivered' } },
  { $group: {
    _id: null,
    avgLatency: { $avg: '$deliveries.metrics.latencyMs' },
    maxLatency: { $max: '$deliveries.metrics.latencyMs' },
    minLatency: { $min: '$deliveries.metrics.latencyMs' }
  }}
])

// Deliveries by host
db.outboxes.aggregate([
  { $unwind: '$deliveries' },
  { $group: {
    _id: '$deliveries.host',
    total: { $sum: 1 },
    delivered: { $sum: { $cond: [{ $eq: ['$deliveries.status', 'delivered'] }, 1, 0] } },
    failed: { $sum: { $cond: [{ $eq: ['$deliveries.status', 'failed'] }, 1, 0] } }
  }},
  { $sort: { total: -1 } }
])
```

## Push Federation Criteria

The worker only delivers activities that meet specific criteria (defined in `/methods/federation/shouldFederate.js`):

### ✅ Push When:

1. **Create** → inside remote Group or Event
2. **Reply** → to remote post
3. **React** → to remote post
4. **Join/Leave** → remote Group or Event
5. **Invite** → to/from remote Group/Event or inviting remote user
6. **Accept/Reject** → remote request
7. **Add/Remove** → remote collection
8. **Flag** → remote content (to notify moderators)

### ❌ Never Push:

1. **Public posts** (addressed to @public) - pull-based discovery
2. **Local server posts** (addressed to @yourserver.com) - local only
3. **Private operations**: Follow, Unfollow, Block, Mute - always private
4. **Unknown activity types** - default to no federation

## Integration with Create Handler

When an activity is created in `/ActivityParser/handlers/Create/index.js`:

```javascript
// 1. Object is saved to database
const created = await Model.create(activity.object);

// 2. Written to FeedItems for timeline delivery
await writeFeedItems(created, type);

// 3. Check if should be pushed to remote servers
const shouldFederate = require('#methods/federation/shouldFederate.js').default;
if (shouldFederate(activity)) {
  // 4. Enqueue in Outbox
  const enqueueOutbox = require('#methods/federation/enqueueOutbox.js').default;
  await enqueueOutbox({
    activity,
    activityId: created.id,
    actorId: created.actorId,
    reason: "Activity targets remote resource",
  });
}

// 5. Worker picks up and delivers asynchronously
```

## Performance Tuning

### Poll Interval

**Fast polling (1 second):**
- Pros: Low latency, near real-time delivery
- Cons: More CPU usage, more database queries

**Slow polling (30 seconds):**
- Pros: Lower overhead
- Cons: Higher latency for remote interactions

**Recommendation:** 5 seconds for balance between latency and overhead.

### Batch Size

**Small batches (5 jobs):**
- Pros: Faster iteration, lower memory
- Cons: More poll cycles needed

**Large batches (20 jobs):**
- Pros: Fewer poll cycles
- Cons: Slower per-cycle, more memory

**Recommendation:** 10 jobs per batch for balance.

### Retry Strategy

Current exponential backoff:
- 1st error: 1 second
- 2nd error: 2 seconds
- 3rd error: 4 seconds
- 4th error: 8 seconds
- 5th error: 16 seconds
- 6th+ error: capped at 1 hour

This prevents hammering broken servers while allowing quick recovery.

### Concurrency Limits

**TODO:** Implement host-level concurrency limits to prevent overwhelming remote servers:
- `hostConcurrency: 2` - Max 2 concurrent deliveries per host
- `globalConcurrency: 10` - Max 10 total concurrent deliveries

Currently all due deliveries are processed sequentially.

## Comparison with Pull Federation

### Push Federation (This Worker)

**When:** Direct interactions with remote resources
**How:** POST to remote inbox with HTTP Signatures
**Examples:** Reply to remote post, join remote group
**Latency:** Near real-time (5 second polling + delivery time)
**Reliability:** Retries with exponential backoff

### Pull Federation (Background Pull Worker)

**When:** Content discovery from followed users/groups
**How:** GET from `/.well-known/kowloon/pull` endpoint
**Examples:** New posts from followed users, group updates
**Latency:** Poll interval (1-15 minutes typical)
**Reliability:** Server-level error tracking with backoff

Both systems work together for hybrid federation:
- **PUSH** for interactions requiring acknowledgment
- **PULL** for content discovery and timeline assembly

## Troubleshooting

### Worker not processing deliveries

**Check 1:** Is the worker running?
```bash
pm2 list  # or systemctl status kowloon-outbox-push
```

**Check 2:** Are there jobs pending delivery?
```javascript
db.outboxes.find({
  status: { $in: ['pending', 'partial'] },
  'counts.pending': { $gt: 0 }
})
```

**Check 3:** Are deliveries due?
```javascript
db.outboxes.find({
  'deliveries.status': 'pending',
  'deliveries.nextAttemptAt': { $lte: new Date() }
})
```

### Deliveries failing with authentication errors

**Check 1:** Is HTTP Signature signing working?
- Verify server has `privateKey` in Settings collection
- Check clock skew (must be within 5 minutes of remote server)
- Verify `keyId` URL is accessible from remote server

**Check 2:** Is the activity payload valid?
- Check if activity matches ActivityPub spec
- Verify required fields are present (type, actor, object)

**Check 3:** Is remote server accepting requests?
```bash
curl -X POST https://remote-server.com/inbox \
  -H "Content-Type: application/activity+json" \
  -d '{"@context":"...","type":"Create",...}'
```

### High failure rates

**Check 1:** Network connectivity
```bash
curl -I https://remote-server.com/inbox
```

**Check 2:** Remote server blocking
- Check if your server's domain/IP is on any blocklists
- Verify remote server's rate limits
- Check if remote server requires specific headers

**Check 3:** Clock skew
- Ensure server time is synchronized (use NTP)
- HTTP Signatures fail if clock is >5 minutes off

### Deliveries stuck in pending

**Check 1:** Is `nextAttemptAt` in the future?
```javascript
db.outboxes.find({
  'deliveries.status': 'pending',
  'deliveries.nextAttemptAt': { $gt: new Date() }
})
```

**Check 2:** Is the worker polling frequently enough?
- Increase poll frequency in `OUTBOX_PUSH_INTERVAL_MS`

**Check 3:** Are there too many jobs?
- Increase `batchSize` in worker config

## Future Enhancements

- [ ] Implement host-level concurrency limits (prevent overwhelming hosts)
- [ ] Implement global concurrency limits (prevent overwhelming worker)
- [ ] Add priority queue (user-initiated actions before automated)
- [ ] Add delivery metrics export (Prometheus/StatsD)
- [ ] Implement delivery webhooks (notify on success/failure)
- [ ] Add support for delivering to shared inboxes (ActivityPub optimization)
- [ ] Implement delivery deduplication across shared inboxes
- [ ] Add configurable retry strategies per activity type
- [ ] Implement circuit breaker for repeatedly failing hosts
- [ ] Add support for delivery batching (group activities to same inbox)

## Receiving Federated Activities (Inbox)

While this document focuses on **outbound** push federation, the server also has an **inbound** endpoint for receiving activities from remote servers.

### Inbox Endpoint

**Route:** `POST /inbox`
**Authentication:** HTTP Signatures (server-to-server)
**Handler:** `/routes/inbox.js`

### Inbox Flow

```
Remote Server                      Local Server
     │                                  │
     │  POST /inbox                     │
     │  HTTP Signature signed           │
     │  Activity JSON payload           │
     ├─────────────────────────────────>│
     │                                  │
     │                            Verify Signature
     │                            (verifyHttpSignature)
     │                                  │
     │                            Validate Payload
     │                            (type, actor, etc)
     │                                  │
     │                            Process Activity
     │                            (ActivityParser)
     │                                  │
     │                            Create/Update Objects
     │                            Write to FeedItems
     │                            Fan-out to Feed
     │                                  │
     │  202 Accepted                    │
     │  Location: object URL            │
     │<─────────────────────────────────┤
```

### Processing Logic

1. **Verify HTTP Signature:** Extract domain and actorId from signature
2. **Validate Payload:** Check required fields (type, actor, object)
3. **Idempotency Check:** Use `Idempotency-Key` header or activity ID
4. **Process Through ActivityParser:** Same logic as local activities
5. **Mark as Remote Origin:** `activity._origin = "remote"`
6. **Return 202 Accepted:** Async processing, Location header if object created

### Security Considerations

- **Always verify HTTP Signatures** - Reject unsigned requests
- **Validate activity structure** - Prevent malformed payloads
- **Rate limiting** - TODO: Implement per-domain rate limits
- **Idempotency** - TODO: Implement Redis-based deduplication
- **Size limits** - Enforce `JSON_LIMIT` (default: 2MB)

### Example Request

```http
POST /inbox HTTP/1.1
Host: kwln.org
Content-Type: application/activity+json
Signature: keyId="https://remote.com/actor#main-key",algorithm="rsa-sha256",...
Idempotency-Key: abc123

{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Create",
  "actor": "https://remote.com/users/alice",
  "object": {
    "type": "Note",
    "content": "Reply to your post!",
    "inReplyTo": "https://kwln.org/posts/xyz"
  }
}
```

### Example Response

```http
HTTP/1.1 202 Accepted
Location: https://kwln.org/posts/abc123
Content-Type: application/json

{
  "id": "post:abc123@kwln.org",
  "url": "https://kwln.org/posts/abc123",
  "status": "accepted"
}
```

## Related Documentation

- [Unified Feed System](UNIFIED_FEED_SYSTEM.md) - Pull-based content retrieval
- [Federation Pull Worker](FEDERATION_PULL_WORKER.md) - Background content fetching
- [HTTP Signatures](../methods/federation/signHttpRequest.js) - Request signing
- [Should Federate Logic](../methods/federation/shouldFederate.js) - Push criteria
- [Inbox Endpoint](../routes/inbox.js) - Receiving federated activities
