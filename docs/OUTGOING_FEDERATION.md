# Outgoing Federation

Kowloon's outgoing federation system implements reliable delivery of activities to remote servers using per-recipient tracking, retry logic, and HTTP signature authentication.

## Architecture

### Two-Layer Data Model

#### 1. Outbox Job (per activity fan-out)
- **Purpose**: Track high-level fan-out operation and aggregate delivery status
- **Fields**:
  - `id`: Stable ID like `outbox:<_id>@domain`
  - `activityId`: Reference to the local Activity being federated
  - `activity`: Immutable snapshot of activity payload
  - `createdBy`: Actor who created the activity
  - `audience`: Array of resolved recipient IDs
  - `status`: Computed from deliveries - `pending`, `delivering`, `partial`, `delivered`, `error`
  - `counts`: Rollup of delivery states - `{ total, pending, delivered, failed, skipped }`
  - `deliveries`: Array of per-recipient delivery subdocuments
  - `dedupeHash`: SHA-256 hash to prevent duplicate fan-outs
  - `ttl`: Automatic cleanup date (90 days after creation)

#### 2. Delivery Subdocument (per remote recipient)
- **Purpose**: Track individual recipient delivery with independent retry state
- **Fields**:
  - `target`: Recipient actor ID
  - `inboxUrl`: Concrete HTTPS endpoint to POST to
  - `host`: Domain for rate limiting and concurrency control
  - `status`: `pending`, `delivering`, `delivered`, `failed`, `skipped`
  - `attempts`: Number of delivery attempts
  - `nextAttemptAt`: When to retry (null = immediately available)
  - `responseStatus`: HTTP status from last attempt
  - `responseHeaders`: Response headers (including Location)
  - `responseBody`: Truncated response body (max 1KB)
  - `error`: Last error details
  - `idempotencyKey`: Unique key for safe retries
  - `remoteActivityId`: ID returned by remote server (from Location header)
  - `metrics`: Latency, bytes sent/received

## Flow

### 1. Activity Creation
```javascript
// In routes/outbox/post.js
const created = await createActivity(activity);

// If federate=true, enqueue for delivery
if (created.federate && createdId) {
  const job = await enqueueOutbox({
    activity: created.activity,
    activityId: createdId,
    actorId: activity.actorId,
    reason: "activity.federate = true"
  });
}
```

### 2. Audience Resolution
```javascript
// methods/federation/resolveAudience.js
// Extracts recipients from activity fields:
// - activity.to
// - activity.target
// - activity.object.to
// - activity.object.inReplyTo
// - activity.object.targetActorId

// Filters out:
// - @public (pull-based)
// - Local recipients
// - Duplicates (by inbox URL)
```

### 3. Job Creation
```javascript
// methods/federation/enqueueOutbox.js
// Creates Outbox job with deliveries array
const job = await Outbox.create({
  activityId,
  activity,
  createdBy: actorId,
  audience: [...recipientIds],
  deliveries: recipientIds.map(r => ({
    target: r.actorId,
    inboxUrl: r.inboxUrl,
    host: r.host,
    status: "pending",
    idempotencyKey: generateIdempotencyKey(),
    nextAttemptAt: new Date() // immediately available
  }))
});
```

### 4. Worker Processing
```javascript
// methods/federation/outboxWorker.js
// Polls every 5 seconds (configurable via OUTBOX_WORKER_INTERVAL)

// For each due delivery:
// 1. Sign request with HTTP signatures
// 2. POST to remote inbox
// 3. Handle response:
//    - 2xx: Mark delivered
//    - 410/404: Mark skipped (actor doesn't exist)
//    - 4xx: Quick retry (2 attempts), then fail
//    - 5xx/error: Exponential backoff retry (up to 5 attempts)
// 4. Update delivery status and metrics
// 5. Job pre-save hook recomputes status and counts
```

## Security

### HTTP Signatures
All outgoing requests are signed with the server actor's private key:

```javascript
// methods/federation/signHttpRequest.js
// Signed headers:
// - (request-target): POST /inbox
// - host: remote.example.com
// - date: Thu, 05 Jan 2023 12:00:00 GMT
// - digest: SHA-256=<base64-hash-of-body>

// Signature header format:
// Signature: keyId="https://local.domain/users/@local.domain#main-key",
//            algorithm="rsa-sha256",
//            headers="(request-target) host date digest",
//            signature="<base64-signature>"
```

### Idempotency
Each delivery has a unique `idempotencyKey` included in request headers to enable safe retries.

### Rate Limiting
- Per-host concurrency limits (default: 2)
- Global concurrency limits (default: 10)
- Exponential backoff on failures

## Retry Logic

### Exponential Backoff
- Base delay: 1 second
- Formula: `delay = min(baseDelay * 2^attempts, maxDelay)`
- Max delay cap: 1 hour
- Max attempts: 5

### Response Handling

| Response | Action | Retry? |
|----------|--------|--------|
| 2xx | Mark delivered, extract Location | No |
| 404/410 | Mark skipped (not found) | No |
| 4xx | Quick retry x2 for clock skew, then fail | Limited |
| 5xx | Exponential backoff retry | Yes (max 5) |
| Network error | Exponential backoff retry | Yes (max 5) |

## API Endpoints

### POST /outbox
Create an activity and optionally federate it.

**Request:**
```json
{
  "type": "Create",
  "objectType": "Post",
  "to": "@alice@remote.example.com",
  "object": {
    "type": "Note",
    "content": "Hello, federation!"
  }
}
```

**Response (when federate=true):**
```json
{
  "ok": true,
  "activity": {...},
  "createdId": "post:abc@local.domain",
  "federate": true,
  "federationJob": {
    "jobId": "outbox:123@local.domain",
    "recipients": 1,
    "counts": {
      "total": 1,
      "pending": 1,
      "delivered": 0,
      "failed": 0,
      "skipped": 0
    }
  }
}
```

### GET /outbox/:id
Get status of a federation job (admin/debug).

**Response:**
```json
{
  "jobId": "outbox:123@local.domain",
  "activityId": "post:abc@local.domain",
  "status": "partial",
  "counts": {
    "total": 3,
    "pending": 1,
    "delivered": 1,
    "failed": 0,
    "skipped": 1
  },
  "deliveries": [
    {
      "target": "@alice@remote.example.com",
      "inboxUrl": "https://remote.example.com/users/alice/inbox",
      "host": "remote.example.com",
      "status": "delivered",
      "attempts": 1,
      "responseStatus": 202,
      "metrics": {
        "latencyMs": 234,
        "bytesSent": 512,
        "bytesReceived": 128
      }
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# Outbox worker polling interval (milliseconds)
OUTBOX_WORKER_INTERVAL=5000

# Domain for signing (required)
DOMAIN=example.com
```

### Worker Configuration

```javascript
// In methods/federation/outboxWorker.js
const CONFIG = {
  batchSize: 10,           // Process N deliveries per tick
  maxAttempts: 5,          // Max retry attempts per delivery
  baseDelayMs: 1000,       // Base delay for exponential backoff (1s)
  maxDelayMs: 3600000,     // Max delay cap (1 hour)
  hostConcurrency: 2,      // Max concurrent deliveries per host
  globalConcurrency: 10,   // Max total concurrent deliveries
  responseBodyMaxBytes: 1024, // Max response body to store
};
```

## Monitoring

### Logs
The worker emits structured logs for:
- Delivery successes
- Delivery failures (with retry info)
- Permanent failures (skipped)
- Worker errors

### Metrics
Each delivery tracks:
- `latencyMs`: Time to complete request
- `bytesSent`: Size of activity payload
- `bytesReceived`: Size of response

### Admin Tools
- Query jobs by status: `Outbox.find({ status: 'failed' })`
- Retry all failed for a host: Update `nextAttemptAt` to now
- Skip remaining for a job: Set deliveries to `skipped`

## Testing

### Manual Testing
1. Create an activity with a remote recipient
2. Check response for `federationJob` with job ID
3. Query `GET /outbox/:jobId` to see delivery status
4. Watch logs for delivery attempts
5. Check MongoDB for job/delivery updates

### Integration Testing
```javascript
// Create a test activity
const response = await fetch('http://localhost:3000/outbox', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    type: 'Reply',
    object: {
      inReplyTo: 'post:xyz@remote.example.com',
      content: 'Test reply'
    }
  })
});

const { federationJob } = await response.json();
console.log('Federation job:', federationJob);

// Check status
const statusResponse = await fetch(`http://localhost:3000/outbox/${federationJob.jobId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const status = await statusResponse.json();
console.log('Deliveries:', status.deliveries);
```

## Troubleshooting

### Deliveries stuck in pending
- Check worker is running: Look for "Starting outbox worker" log
- Check MongoDB connectivity
- Check `nextAttemptAt` is not in the future
- Verify server actor exists with private key

### All deliveries failing with auth errors
- Verify server actor (`@domain`) exists in Users collection
- Verify server actor has `privateKey` field populated
- Check remote server logs for signature verification errors
- Verify system clock is accurate (clock skew causes auth failures)

### Audience resolution returns no recipients
- Check activity has `to`, `target`, or `object.inReplyTo` fields
- Verify recipients are remote (not local domain)
- Check recipient actors can be fetched via `getObjectById`
- Verify recipient actors have valid `inbox` URLs
