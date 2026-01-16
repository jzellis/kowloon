# Federation Pull Worker

## Overview

The federation pull worker runs in the background, proactively fetching content from remote servers that local users are interested in. This keeps the local FeedItems cache fresh so content is already available when users request their timelines.

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                  BACKGROUND PROCESS                          │
└─────────────────────────────────────────────────────────────┘
                           │
                    Every 1 minute (configurable)
                           │
              ┌────────────┴────────────┐
              │                         │
         Find Servers              Build Pull
         Ready to Poll             Parameters
              │                         │
              │              ┌───────────┴───────────┐
              │              │                       │
              │         Local Users'           Local Users'
              │         Following Circles      Groups/Events Circles
              │              │                       │
              │         Extract Remote        Extract Remote
              │         Authors to Pull       Groups/Events
              │              │                       │
              │              └───────────┬───────────┘
              │                          │
              └─────────────┬────────────┘
                            │
                    Pull from Remote Server
                 /.well-known/kowloon/pull
                            │
                     Upsert to FeedItems
                            │
                   Update Server Metadata
                 (nextPullAt, lastPulledAt, etc.)
```

## Worker Logic

### 1. Server Selection

Every poll interval, the worker:
1. Queries `Server` collection for servers ready to poll
2. Filters by `status != 'blocked'` and `nextPullAt <= now`
3. Processes up to `BATCH_SIZE` servers (default: 10)

### 2. Parameter Building

For each server, the worker:
1. Finds all local users
2. Checks each user's Circles:
   - `following` Circle → Extract remote authors to follow
   - `groups` Circle → Extract remote groups user is in
   - `events` Circle → Extract remote events user is attending
3. Builds pull parameters:
   ```javascript
   {
     members: ['@alice@serverA.com'],  // Local users interested in this server
     authors: ['@bob@serverB.com'],    // Remote authors to pull
     groups: ['@group123@serverB.com'], // Remote groups to pull
     events: ['@event456@serverB.com']  // Remote events to pull
   }
   ```

### 3. Content Fetching

For each server with parameters:
1. Makes GET request to `https://{server}/.well-known/kowloon/pull`
2. Includes `since` parameter (last successful pull timestamp)
3. TODO: Signs request with HTTP Signature
4. Receives ActivityStreams OrderedCollection
5. Upserts items into local FeedItems

### 4. Metadata Updates

After each pull attempt:
- **Success:**
  - `lastPulledAt` = now
  - `lastPullAttemptedAt` = now
  - `pullErrorCount` = 0
  - `nextPullAt` = now + 5 minutes (if got items) or now + 15 minutes (if empty)

- **Failure:**
  - `lastPullAttemptedAt` = now
  - `pullErrorCount++`
  - `lastPullError` = error message
  - `nextPullAt` = exponential backoff (5min → 15min → 30min → 1hr → 2hr max)

### 5. Skip Logic

The worker skips a server if:
- No local users have any interest (no follows, no groups, no events)
- Updates `nextPullAt` to avoid re-checking too soon (1 hour)

## Configuration

### Environment Variables

```bash
# Poll interval (default: 60000ms = 1 minute)
FEDERATION_PULL_INTERVAL_MS=60000

# Batch size (servers per batch, default: 10)
FEDERATION_PULL_BATCH_SIZE=10
```

### Server-Level Configuration

Each `Server` document can configure:
- `status` - Set to `'blocked'` to prevent polling
- Pull timeout will use default 30 seconds

## Running the Worker

### Development

```bash
node workers/federationPull.js
```

### Production with PM2

```bash
pm2 start workers/federationPull.js --name "federation-pull"
pm2 save
```

### Production with systemd

Create `/etc/systemd/system/kowloon-federation-pull.service`:

```ini
[Unit]
Description=Kowloon Federation Pull Worker
After=mongodb.service

[Service]
Type=simple
User=kowloon
WorkingDirectory=/path/to/kowloon
ExecStart=/usr/bin/node workers/federationPull.js
Restart=always
Environment=NODE_ENV=production
Environment=MONGO_URI=mongodb://localhost:27017/kowloon
Environment=FEDERATION_PULL_INTERVAL_MS=60000

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable kowloon-federation-pull
sudo systemctl start kowloon-federation-pull
sudo systemctl status kowloon-federation-pull
```

## Monitoring

### Check Worker Status

```bash
# With PM2
pm2 logs federation-pull

# With systemd
sudo journalctl -u kowloon-federation-pull -f
```

### Check Server Pull Status

```javascript
// Servers pending pull
db.servers.find({
  status: { $ne: 'blocked' },
  nextPullAt: { $lte: new Date() }
}).count()

// Recently pulled servers
db.servers.find({
  lastPulledAt: { $gte: new Date(Date.now() - 3600000) } // Last hour
}).sort({ lastPulledAt: -1 })

// Servers with errors
db.servers.find({
  pullErrorCount: { $gt: 0 }
}).sort({ pullErrorCount: -1 })
```

### Check Cached Items

```javascript
// Remote items cached in last hour
db.feeditems.find({
  origin: 'remote',
  createdAt: { $gte: new Date(Date.now() - 3600000) }
}).count()

// Items by remote domain
db.feeditems.aggregate([
  { $match: { origin: 'remote' } },
  { $group: { _id: '$originDomain', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])
```

## Performance Tuning

### Poll Interval

**Fast polling (1 minute):**
- Pros: Fresh content, low latency
- Cons: More network traffic, more server load

**Slow polling (15 minutes):**
- Pros: Lower load, less traffic
- Cons: Stale content, higher latency

**Recommendation:** Start with 1 minute, increase if load is too high.

### Batch Size

**Small batches (5 servers):**
- Pros: Faster iteration, lower memory
- Cons: More poll cycles needed

**Large batches (20 servers):**
- Pros: Fewer poll cycles
- Cons: Slower per-cycle, more memory

**Recommendation:** 10 servers per batch for balance.

### Backoff Strategy

Current exponential backoff:
- 1st error: 5 minutes
- 2nd error: 10 minutes
- 3rd error: 20 minutes
- 4th error: 40 minutes
- 5th+ error: 80 minutes (capped at 2 hours)

This prevents hammering broken servers while allowing quick recovery.

## Comparison with Old System

### Old: POST /federation/pull (Complex Cursors)

**Pros:**
- Sophisticated cursor management per scope
- Fine-grained error tracking per scope
- Compression support

**Cons:**
- Complex cursor logic (actors/audience hashes)
- JWT signing required
- POST endpoints less cacheable

### New: GET /.well-known/kowloon/pull (Simple Parameters)

**Pros:**
- Simple query parameters (no cursor complexity)
- GET requests (cacheable)
- HTTP Signature auth (standard)
- Same endpoint for users and servers

**Cons:**
- No per-scope cursor tracking yet
- Simpler error handling

**Recommendation:** Both can coexist. Old system for complex scenarios, new for simple pulls.

## Troubleshooting

### Worker not pulling

**Check 1:** Is the worker running?
```bash
pm2 list  # or systemctl status kowloon-federation-pull
```

**Check 2:** Are there servers ready to poll?
```javascript
db.servers.find({
  status: { $ne: 'blocked' },
  $or: [
    { nextPullAt: { $lte: new Date() } },
    { nextPullAt: { $exists: false } }
  ]
})
```

**Check 3:** Do local users follow anyone on remote servers?
```javascript
// Check if any user follows remote users
db.circles.find({
  'members.id': /@.+@(?!yourlocaldomain\.com).+$/
})
```

### Items not being cached

**Check 1:** Are pull requests succeeding?
```javascript
db.servers.find({ pullErrorCount: { $gt: 0 } })
```

**Check 2:** Is remote server returning items?
- Check worker logs for item counts
- Verify remote server's /.well-known/kowloon/pull endpoint

**Check 3:** Are items being upserted?
- Check for upsert errors in worker logs
- Verify FeedItems schema matches remote item structure

### High error rates

**Check 1:** Network connectivity
```bash
curl https://remote-server.com/.well-known/kowloon/pull
```

**Check 2:** HTTP Signature verification
- Remote server may be rejecting unsigned requests
- TODO: Implement signature signing in worker

**Check 3:** Server blocking
- Check if remote server has rate limits
- Verify our server is not blocked

## Future Enhancements

- [ ] Add HTTP Signature signing to pull requests
- [ ] Implement per-scope cursor tracking (public/actors/audience)
- [ ] Add compression support (Accept-Encoding: gzip, br)
- [ ] Implement adaptive polling (more frequent if new items, less if quiet)
- [ ] Add metrics export (Prometheus/StatsD)
- [ ] Implement priority queue (active users' servers polled more often)
- [ ] Add webhook support (servers can push updates instead of polling)
- [ ] Implement distributed worker coordination (multiple workers, no overlap)
