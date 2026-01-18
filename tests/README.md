# Federation Tests

Tests for the hybrid federation system (push + pull) between isolated Kowloon instances.

## Test Instances

Three isolated instances running in Docker:
- **kwln.org** - Database: `kowloon_kwln-org_ac3c8f02`
- **kowloon.net** - Database: `kowloon_kowloon-net_63f81abc`
- **kowlunatics.net** - Database: `kowloon_kowlunatics-net_6845a7d6`

Each instance has its own:
- Separate MongoDB database
- Background workers (outbox push + federation pull)
- User base, posts, and content

## Quick Test

Verify all federation endpoints are responding:

```bash
node tests/federation-quick.test.js
```

Expected output:
```
🧪 Quick Federation Test

Testing kwln.org...
  ✓ Health: 200
  ✓ Inbox: 401 (protected)
  ✓ Pull: 401 (protected)
  ✓ Timeline: 401 (protected)

Testing kowloon.net...
  ✓ Health: 200
  ✓ Inbox: 401 (protected)
  ✓ Pull: 401 (protected)
  ✓ Timeline: 401 (protected)

Testing kowlunatics.net...
  ✓ Health: 200
  ✓ Inbox: 401 (protected)
  ✓ Pull: 401 (protected)
  ✓ Timeline: 401 (protected)

✓ All endpoints responding correctly!
```

## Full Federation Test

Tests the complete federation workflow:

```bash
# With database wipe
WIPE=1 ADMIN_PASSWORD=12345 node tests/federation-hybrid.test.js

# Without wipe (reuse existing data)
ADMIN_PASSWORD=12345 node tests/federation-hybrid.test.js
```

### Test Flow

1. **Setup** - Creates user `alice` on each server
2. **Create Post** - Alice@kwln creates a public post
3. **Follow** - Alice@kowloon follows Alice@kwln
4. **Wait for Pull** - Federation pull worker fetches content (60s)
5. **Verify Pull** - Check if post appears in Alice@kowloon's timeline
6. **Create Reply** - Alice@kowlunatics replies to the post
7. **Wait for Push** - Outbox worker delivers reply (5s)
8. **Verify Push** - Check if reply appears on kwln.org
9. **Check Outbox** - Verify delivery tracking
10. **Test Pull Endpoint** - Verify `/.well-known/kowloon/pull`
11. **Test Inbox Endpoint** - Verify `POST /inbox`

### Expected Output

```
=== Hybrid Federation Test Suite ===

Testing federation between:
  • kwln.org
  • kowloon.net
  • kowlunatics.net

[1] Creating users on each server
  • Wiping database for kwln...
  • Creating user alice@kwln...
  ✓ Created alice@kwln (@alice@kwln.org)
  • Creating user alice@kowloon...
  ✓ Created alice@kowloon (@alice@kowloon.net)
  • Creating user alice@kowlunatics...
  ✓ Created alice@kowlunatics (@alice@kowlunatics.net)

[2] Alice@kwln creates a public post
  ✓ Created post: post:xyz@kwln.org

[3] Alice@kowloon follows Alice@kwln
  ✓ Alice@kowloon is now following Alice@kwln

[4] Waiting for federation pull worker (60s poll interval)
  • Sleeping 65 seconds for pull worker to run...
  ✓ Wait complete

[5] Checking if post was pulled to kowloon.net
  • Timeline has 1 items
  ✓ Post found in timeline! (origin: remote)
  • Content: "Hello from kwln.org! Testing federation."

[6] Alice@kowlunatics replies to the post (PUSH federation)
  ✓ Created reply: reply:abc@kowlunatics.net
  • Outbox worker should push this to kwln.org inbox within 5 seconds

[7] Waiting for outbox push worker (5s poll interval)
  • Sleeping 10 seconds for push worker to deliver...
  ✓ Wait complete

[8] Checking if reply was pushed to kwln.org
  ✓ Reply found on kwln.org! (origin: remote)
  • Content: "Nice post! Replying from kowlunatics.net"

[9] Checking outbox delivery status
  • Would check Outbox collection for delivery status here
  ✓ Skipped (requires outbox query endpoint)

[10] Testing /.well-known/kowloon/pull endpoint
  ✓ Pull endpoint requires authentication (correct)

[11] Testing POST /inbox endpoint
  ✓ Inbox endpoint requires authentication (correct)

=== Test Results ===

Pull Federation: ✓ PASSED
Push Federation: ✓ PASSED

✓ All federation tests PASSED!
```

## What Each Test Validates

### Pull Federation Test
- Federation pull worker runs on schedule
- Worker identifies remote content to fetch
- Makes GET request to `/.well-known/kowloon/pull`
- Remote server filters content appropriately
- Items upserted into local FeedItems
- Items appear in requester's timeline

### Push Federation Test
- Create handler checks `shouldFederate()`
- Activity enqueued in Outbox
- Outbox worker picks up job
- Worker signs request with HTTP Signature
- POSTs to remote `/inbox` endpoint
- Remote server verifies signature
- Activity processed through ActivityParser
- Item created on remote server

## Debugging Failed Tests

### Pull Federation Fails

Check federation pull worker logs:
```bash
docker logs kowloon-kowloon-net-63f81abc 2>&1 | grep "Federation pull"
```

Check if Server records exist:
```javascript
db.servers.find({ domain: "kwln.org" })
```

Check if user is following:
```javascript
db.circles.findOne({ id: "circle:following@alice@kowloon.net" })
```

### Push Federation Fails

Check outbox worker logs:
```bash
docker logs kowloon-kowlunatics-net-6845a7d6 2>&1 | grep "Outbox"
```

Check Outbox jobs:
```javascript
db.outboxes.find().sort({ createdAt: -1 }).limit(5)
```

Check delivery status:
```javascript
db.outboxes.findOne({}, { deliveries: 1 })
```

### HTTP Signature Issues

- Verify server has private key in Settings
- Check clock sync (must be within 5 minutes)
- Verify keyId URL is accessible
- Check logs for signature verification errors

## Environment Variables

- `WIPE=1` - Wipe all databases before testing
- `ADMIN_PASSWORD=12345` - Password for test users
- `DEBUG=1` - Enable debug logging (if implemented)

## Manual Testing

You can also test federation manually using curl:

### Test Pull Endpoint (requires HTTP Signature)
```bash
curl -i https://kwln.org/.well-known/kowloon/pull
# Should return 401 without signature
```

### Test Inbox (requires HTTP Signature)
```bash
curl -i -X POST https://kwln.org/inbox \
  -H "Content-Type: application/activity+json" \
  -d '{"type":"Create","object":{"type":"Note","content":"Test"}}'
# Should return 401 without signature
```

### Check Timeline (requires JWT)
```bash
# First, get a token
TOKEN=$(curl -s -X POST https://kwln.org/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"12345"}' | jq -r .token)

# Then query timeline
curl -s https://kwln.org/feed/timeline \
  -H "Authorization: Bearer $TOKEN" | jq .
```

## Monitoring Workers

Watch worker activity in real-time:

```bash
# All workers
docker logs -f kowloon-kwln-org-ac3c8f02

# Just outbox worker
docker logs -f kowloon-kwln-org-ac3c8f02 2>&1 | grep "Outbox"

# Just federation pull worker
docker logs -f kowloon-kwln-org-ac3c8f02 2>&1 | grep "Federation pull"

# Check running processes
docker exec kowloon-kwln-org-ac3c8f02 ps aux
```

## Related Documentation

- [Federation Overview](../docs/FEDERATION_OVERVIEW.md)
- [Federation Push Worker](../docs/FEDERATION_PUSH_WORKER.md)
- [Federation Pull Worker](../docs/FEDERATION_PULL_WORKER.md)
- [Unified Feed System](../docs/UNIFIED_FEED_SYSTEM.md)
