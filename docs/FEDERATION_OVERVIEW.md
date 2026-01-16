# Federation Overview

## Complete Hybrid Federation System

Kowloon implements a hybrid federation model combining **PUSH** and **PULL** mechanisms for optimal performance and user experience.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                      HYBRID FEDERATION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │   PUSH FEDERATION    │         │   PULL FEDERATION    │     │
│  │  (Direct Actions)    │         │  (Content Discovery) │     │
│  └──────────────────────┘         └──────────────────────┘     │
│           │                                    │                 │
│           │                                    │                 │
│    Outbox Worker                      Federation Pull Worker    │
│    (Every 5 seconds)                  (Every 1 minute)          │
│           │                                    │                 │
│           ↓                                    ↓                 │
│    POST /inbox                          GET /.well-known/       │
│    (Remote servers)                     kowloon/pull            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SHARED COMPONENTS                            │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • HTTP Signatures (server-to-server auth)               │  │
│  │  • ActivityParser (process all activities)               │  │
│  │  • FeedItems (canonical object storage)                  │  │
│  │  • Feed (per-viewer fan-out for privacy)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## System Components

### 1. Push Federation (Outbound)

**Purpose:** Deliver direct interactions to remote servers in near real-time

**When Used:**
- Reply to remote post
- React to remote post
- Join/leave remote group/event
- Invite to/from remote resource
- Accept/reject remote request

**Components:**
- **Create Handler** ([ActivityParser/handlers/Create/index.js](../ActivityParser/handlers/Create/index.js)) - Checks `shouldFederate()` and enqueues
- **Should Federate** ([methods/federation/shouldFederate.js](../methods/federation/shouldFederate.js)) - Determines if activity needs push
- **Enqueue Outbox** ([methods/federation/enqueueOutbox.js](../methods/federation/enqueueOutbox.js)) - Creates outbox job
- **Outbox Worker** ([workers/outboxPush.js](../workers/outboxPush.js)) - Delivers to remote inboxes
- **Outbox Schema** ([schema/Outbox.js](../schema/Outbox.js)) - Job queue with retry logic

**Flow:**
```
Local user creates reply to remote post
  ↓
Create handler processes
  ↓
shouldFederate() → YES
  ↓
enqueueOutbox() creates job
  ↓
Worker picks up (5s polling)
  ↓
Signs with HTTP Signature
  ↓
POST to remote /inbox
  ↓
Remote server processes
  ↓
Worker updates status
```

**Latency:** ~5 seconds (poll interval) + network latency

### 2. Push Federation (Inbound)

**Purpose:** Receive activities from remote servers

**Components:**
- **Inbox Endpoint** ([routes/inbox.js](../routes/inbox.js)) - `POST /inbox`
- **HTTP Signature Verification** ([methods/federation/verifyHttpSignature.js](../methods/federation/verifyHttpSignature.js))
- **ActivityParser** - Same processing as local activities

**Flow:**
```
Remote server POSTs activity
  ↓
Verify HTTP Signature
  ↓
Validate payload
  ↓
Process through ActivityParser
  ↓
Create/update objects
  ↓
Write to FeedItems
  ↓
Fan-out to Feed (if needed)
  ↓
Return 202 Accepted
```

**Authentication:** HTTP Signatures (RFC 7231)

### 3. Pull Federation (Outbound)

**Purpose:** Proactively fetch content from remote servers for local users

**When Used:**
- Posts from followed users
- Updates in joined groups
- Updates to attended events
- Public posts from known servers

**Components:**
- **Federation Pull Worker** ([workers/federationPull.js](../workers/federationPull.js))
- **Query Items** ([methods/feed/queryItems.js](../methods/feed/queryItems.js)) - Build pull parameters
- **Server Schema** ([schema/Server.js](../schema/Server.js)) - Track pull state

**Flow:**
```
Every 1 minute:
  ↓
Find servers ready to poll
  ↓
For each server:
  - Check what local users want
  - Build pull params (members, authors, groups, events)
  ↓
GET /.well-known/kowloon/pull?...
  ↓
Remote server returns items
  ↓
Upsert to local FeedItems
  ↓
Update server metadata
```

**Benefits:**
- Content pre-cached before user requests
- Reduced timeline latency
- Background processing

### 4. Pull Federation (Inbound)

**Purpose:** Serve content to remote servers requesting it

**Components:**
- **Pull Endpoint** ([routes/well-known/kowloon-pull.js](../routes/well-known/kowloon-pull.js)) - `GET /.well-known/kowloon/pull`
- **Query Items** - Privacy-aware filtering
- **HTTP Signature Verification** - Server authentication

**Flow:**
```
Remote server requests content
  ↓
Verify HTTP Signature
  ↓
Parse query params (members, authors, groups, events)
  ↓
Build privacy-aware query
  ↓
Return ActivityStreams OrderedCollection
```

**Privacy:**
- Circle IDs never exposed
- Group/Event membership verified
- Only returns content remote server should see

## Feed System Integration

### FeedItems (Canonical Storage)

**Purpose:** Store one canonical copy of each object

**Fields:**
- `id` - Global unique identifier
- `actorId` - Author
- `to` - Visibility (public/server/audience)
- `group` - Group ID if addressed to group
- `event` - Event ID if addressed to event
- `origin` - local/remote
- `object` - Sanitized content

**Privacy:** Circle IDs NEVER stored

### Feed (Per-Viewer Fan-Out)

**Purpose:** Lookup table for Circle-based posts

**Fields:**
- `actorId` - Viewer who should see this
- `objectId` - FeedItems.id
- `reason` - Why they see it (follow/audience/mention)

**Privacy:** Write amplification protects Circle membership

## Timeline Assembly

When a user requests their timeline:

```
GET /feed/timeline
  ↓
Determine context (circle/author/group/event/server/default)
  ↓
For Circle timeline:
  - Query Feed collection (pre-fanned local)
  - TODO: Pull from remote for remote members
  ↓
For Group/Event timeline:
  - Query FeedItems WHERE group=X (local)
  - Pull from remote server if remote group
  ↓
For Author timeline:
  - Query FeedItems (local author)
  - Pull from remote server (remote author)
  ↓
Deduplicate, sort, limit
  ↓
Return OrderedCollection
```

## Running the Complete System

### Development

```bash
# Terminal 1: Main server
npm start

# Terminal 2: Outbox push worker (outbound push)
node workers/outboxPush.js

# Terminal 3: Federation pull worker (outbound pull)
node workers/federationPull.js
```

### Production with PM2

```bash
pm2 start ecosystem.config.js

# Or individually:
pm2 start server.js --name "kowloon-server"
pm2 start workers/outboxPush.js --name "outbox-push"
pm2 start workers/federationPull.js --name "federation-pull"
pm2 save
```

### Production with systemd

Create services for each component:
- `kowloon-server.service` - Main web server
- `kowloon-outbox-push.service` - Outbox worker
- `kowloon-federation-pull.service` - Pull worker

See individual documentation for service file examples.

## Configuration

### Environment Variables

```bash
# MongoDB
MONGO_URI=mongodb://localhost:27017/kowloon

# Server
DOMAIN=kwln.org
PORT=3000

# Workers
OUTBOX_PUSH_INTERVAL_MS=5000          # 5 seconds
FEDERATION_PULL_INTERVAL_MS=60000     # 1 minute
FEDERATION_PULL_BATCH_SIZE=10         # Servers per batch
```

## Monitoring

### Check All Workers

```bash
# With PM2
pm2 list
pm2 logs

# With systemd
systemctl status kowloon-*
journalctl -u kowloon-* -f
```

### Database Queries

```javascript
// Outbox status
db.outboxes.find({ status: { $in: ['pending', 'partial'] } }).count()

// Server pull status
db.servers.find({ pullErrorCount: { $gt: 0 } }).count()

// Recent federated items
db.feeditems.find({ origin: 'remote', createdAt: { $gte: new Date(Date.now() - 3600000) } }).count()

// Feed fan-out status
db.feeds.aggregate([
  { $group: { _id: '$reason', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

## Decision Matrix: Push vs Pull

| Activity Type | Mechanism | Why |
|--------------|-----------|-----|
| Reply to remote post | PUSH | Requires acknowledgment |
| React to remote post | PUSH | Requires acknowledgment |
| Join remote group | PUSH | Membership update |
| Post to @public | PULL | Discovery-based |
| Post to remote group | PUSH | Direct interaction |
| New post from followed user | PULL | Background fetch |
| Follow/Unfollow | Neither | Private operation |

## Performance Characteristics

### Push Federation

**Latency:** ~5-10 seconds
**Reliability:** Retries with exponential backoff (max 5 attempts)
**Load:** Spiky (bursts when users active)
**Cost:** Network requests per interaction

### Pull Federation

**Latency:** 1-15 minutes (configurable)
**Reliability:** Continuous with backoff on errors
**Load:** Steady, predictable
**Cost:** Regular polling even when quiet

## Security

### Authentication

- **Server-to-Server:** HTTP Signatures (RFC 7231)
- **User-to-Server:** JWT tokens

### Verification

- **Outbound:** Sign all POST requests to remote inboxes
- **Inbound:** Verify all incoming POST requests to /inbox
- **Pull Requests:** Sign GET requests (TODO in pull worker)

### Privacy

- **Circle IDs:** Never stored in queryable collections
- **Group/Event IDs:** Stored (public containers)
- **Fan-out:** Write amplification protects membership
- **Access Control:** Verify membership before serving content

## Troubleshooting

### Activities not being pushed

1. Check if `shouldFederate()` returns true
2. Check Outbox for pending jobs
3. Check outbox worker is running
4. Check HTTP signature signing

### Content not being pulled

1. Check federation pull worker is running
2. Check Server collection for pull errors
3. Check if local users follow remote users
4. Check HTTP signature verification

### Inbox rejecting activities

1. Check HTTP signature verification
2. Check clock skew (<5 minutes)
3. Check activity payload structure
4. Check ActivityParser error logs

## Related Documentation

- [Unified Feed System](UNIFIED_FEED_SYSTEM.md) - Complete feed architecture
- [Federation Push Worker](FEDERATION_PUSH_WORKER.md) - Outbound push details
- [Federation Pull Worker](FEDERATION_PULL_WORKER.md) - Content fetching details
- [HTTP Signatures](../methods/federation/signHttpRequest.js) - Signature implementation
- [Should Federate](../methods/federation/shouldFederate.js) - Push criteria logic
- [Query Items](../methods/feed/queryItems.js) - Privacy-aware queries

## Future Enhancements

### Near-term
- [ ] Sign HTTP requests in pull worker (currently unsigned)
- [ ] Implement Redis-based idempotency cache for inbox
- [ ] Add per-domain rate limiting for inbox
- [ ] Implement Circle timeline remote pulls

### Long-term
- [ ] WebSocket/WebSub for real-time push notifications
- [ ] Shared inbox support (ActivityPub optimization)
- [ ] Circuit breaker for repeatedly failing hosts
- [ ] Distributed worker coordination (multiple instances)
- [ ] Delivery metrics export (Prometheus/StatsD)
