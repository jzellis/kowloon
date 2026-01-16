# Unified Feed System

## Overview

The Kowloon feed system provides a unified architecture for retrieving content from both local and remote sources. It combines pre-computed fan-out rows (for Circle-based privacy), direct queries (for public/group/event content), and federation pulls (for remote content).

## Architecture

### Three-Tier Data Model

```
┌──────────────┐
│   FeedItems  │  Canonical object storage (1 record per post)
│  (canonical) │  - Stores group/event IDs (public containers)
└──────────────┘  - Never stores Circle IDs (privacy!)
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│     Feed     │  │    Groups    │  │    Events    │
│ (fan-out LUT)│  │   (public)   │  │   (public)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Collections

#### 1. **FeedItems** (Canonical Storage)
- One record per object (Post, Reply, Event, etc.)
- Stores both local and remote content
- Key fields:
  - `id` - Global unique identifier
  - `actorId` - Author
  - `to` - Visibility: "public" | "server" | "audience"
  - `group` - Group ID if addressed to a group (NEW)
  - `event` - Event ID if addressed to an event (NEW)
  - `origin` - "local" | "remote"
  - `object` - Sanitized content envelope

#### 2. **Feed** (Per-Viewer Fan-Out)
- One record per viewer who should see an item
- Used for Circle-based posts (privacy protection)
- Key fields:
  - `actorId` - Viewer
  - `objectId` - FeedItems.id
  - `reason` - "follow" | "audience" | "domain" | "mention" | "self"

#### 3. **Group / Event** (Public Containers)
- Public or semi-public containers
- Membership stored in Circles
  - `Group.members` → Circle ID
  - `Event.attending` → Circle ID

---

## Query API

### Unified Query Builder

**Method:** `Kowloon.feed.queryItems(options)`

**Parameters:**
```javascript
{
  members: ['@alice@serverA.com'],     // Items visible to these users
  authors: ['@bob@serverB.com'],       // Public items by these authors
  groups: ['@group123@serverB.com'],   // Items addressed to these groups
  events: ['@event456@serverB.com'],   // Items addressed to these events
  since: '2026-01-16T10:00:00Z',       // Items after this timestamp
  limit: 50,                            // Max results (default: 50, max: 500)
  requestingDomain: 'serverA.com'      // For federation auth checks
}
```

**Returns:** Array of FeedItems

**Usage:**
- Federation endpoints use this to serve content to remote servers
- Local endpoints use this to query local content
- Timeline assembly uses this to fetch remote content

---

## Endpoints

### 1. Federation Pull (Server-to-Server)

**Endpoint:** `GET /.well-known/kowloon/pull`

**Authentication:** HTTP Signature (server-to-server)

**Query Parameters:**
- `members` - Comma-separated user IDs
- `authors` - Comma-separated author IDs
- `groups` - Comma-separated group IDs
- `events` - Comma-separated event IDs
- `since` - ISO 8601 timestamp
- `limit` - Max results (default: 50, max: 500)

**Example:**
```
GET /.well-known/kowloon/pull?authors=@bob@serverB.com&since=2026-01-16T10:00:00Z&limit=50
Signature: keyId="...",algorithm="rsa-sha256",...
```

**Response:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "totalItems": 25,
  "orderedItems": [...],
  "next": "2026-01-16T09:30:00.000Z"
}
```

### 2. Local Pull (User/App Access)

**Endpoint:** `GET /feed/pull`

**Authentication:** Optional JWT (for private content)

**Query Parameters:** Same as federation endpoint

**Access Control:**
- Unauthenticated: Public content only (no `members` filter allowed)
- Authenticated: Can filter by `members` but only for own user ID

**Example:**
```
GET /feed/pull?authors=@bob@serverB.com&limit=50
Authorization: Bearer <jwt>
```

### 3. Unified Timeline

**Endpoint:** `GET /feed/timeline`

**Authentication:** Required (JWT)

**Query Parameters:**
- `circle` - Circle ID to show posts from members
- `author` - Author ID to show posts by this user
- `group` - Group ID to show posts to this group
- `event` - Event ID to show posts to this event
- `server` - Server domain to show public posts from
- `since` - ISO 8601 timestamp
- `limit` - Max results (default: 50, max: 500)

**Timeline Types:**

#### Circle Timeline
```
GET /feed/timeline?circle=circle:following@serverA.com
```
Shows posts by members of the specified Circle.
- **Local:** Query Feed collection (pre-fanned)
- **Remote:** TODO - Pull from remote servers for remote members

#### Author Timeline
```
GET /feed/timeline?author=@bob@serverB.com
```
Shows posts by a specific user.
- **Local:** Query FeedItems + filter by membership
- **Remote:** Pull from remote server with `authors` param

#### Group Timeline
```
GET /feed/timeline?group=@group123@serverA.com
```
Shows posts addressed to a group.
- **Local:** Query FeedItems WHERE `group=...` (with access check)
- **Remote:** Pull from remote server with `groups` param

#### Event Timeline
```
GET /feed/timeline?event=@event456@serverA.com
```
Shows posts addressed to an event.
- **Local:** Query FeedItems WHERE `event=...` (with access check)
- **Remote:** Pull from remote server with `events` param

#### Server Timeline
```
GET /feed/timeline?server=@serverA.com
```
Shows public posts from a server.
- **Local:** Query FeedItems WHERE `to=public OR to=server`
- **Remote:** Pull from remote server (no filters = public posts)

#### Default Timeline
```
GET /feed/timeline
```
Shows combined feed from all sources.
- Uses Feed collection (pre-fanned local content)

---

## Content Creation Flow

### When a Post is Created

```javascript
// 1. User creates post
POST /outbox
{
  type: "Create",
  object: {
    type: "Note",
    content: "Hello world!",
    to: "group:abc123@serverA.com"  // or @public, @serverA.com, circle:xyz
  }
}

// 2. ActivityParser Create handler
// - Saves to Post collection
// - Writes to FeedItems with group/event extracted

// 3. FeedItems entry created
{
  id: "post:xyz@serverA.com",
  actorId: "@alice@serverA.com",
  objectType: "Post",
  to: "audience",           // normalized
  group: "group:abc123@serverA.com",  // extracted from 'to'
  event: undefined,
  // ...
}

// 4. FeedFanOut job enqueued
// - Background worker processes
// - Creates Feed rows for each viewer

// 5. Feed rows created (1 per viewer)
{
  actorId: "@viewer1@serverA.com",
  objectId: "post:xyz@serverA.com",
  reason: "audience"
}
```

### Group/Event Extraction Logic

**In:** `ActivityParser/handlers/Create/index.js`

```javascript
// Extract group/event from 'to' field
if (created.to && typeof created.to === 'string') {
  const toValue = created.to.trim();
  if (toValue.startsWith('group:')) {
    group = toValue;  // Store in FeedItems
  } else if (toValue.startsWith('event:')) {
    event = toValue;  // Store in FeedItems
  }
  // Circle IDs are NEVER stored (privacy!)
}
```

---

## Privacy Model

### Circle Privacy (Maximum Protection)

✅ **Circle IDs never stored in FeedItems**
- Cannot reverse-engineer who's in a Circle
- Cannot enumerate Circle members from public data

✅ **Feed rows are per-viewer**
- Only the viewer can see their Feed rows
- Cannot query "who else saw this post"

✅ **Write amplification for privacy**
- 1000 Circle members = 1000 Feed rows
- Trade-off: Write cost for read speed + privacy

### Group/Event Visibility (Public Containers)

✅ **Group/Event IDs ARE stored in FeedItems**
- Groups and Events are public or semi-public containers
- Membership can be verified via `Group.members` / `Event.attending` Circles
- Safe to expose in queries

✅ **Access control on queries**
- Public groups/events: Anyone can query
- Private groups/events: Only members can query

---

## Query Patterns & Performance

### Timeline Type → Data Sources

| Type | Local Source | Remote Source | Performance |
|------|-------------|---------------|-------------|
| Circle | Feed collection | TODO: Pull remote | O(1) - indexed on actorId |
| Author (local) | FeedItems + filter | N/A | O(N) - filter by membership |
| Author (remote) | N/A | Federation pull | Network latency |
| Group (local) | FeedItems WHERE group | N/A | O(1) - indexed on group |
| Group (remote) | N/A | Federation pull | Network latency |
| Event (local) | FeedItems WHERE event | N/A | O(1) - indexed on event |
| Event (remote) | N/A | Federation pull | Network latency |
| Server (local) | FeedItems WHERE to=public | N/A | O(1) - indexed on to |
| Server (remote) | N/A | Federation pull | Network latency |
| Default | Feed collection | N/A | O(1) - indexed on actorId |

### Indexes Required

**FeedItems:**
- `{ id: 1 }` - Unique, de-dupe
- `{ actorId: 1, publishedAt: -1 }` - Author timelines
- `{ group: 1 }` - Group timelines
- `{ event: 1 }` - Event timelines
- `{ to: 1, publishedAt: -1 }` - Public/server timelines
- `{ originDomain: 1, publishedAt: -1 }` - Federation ops

**Feed:**
- `{ actorId: 1, objectId: 1 }` - Unique, de-dupe
- `{ actorId: 1, createdAt: -1 }` - Timeline queries
- `{ actorId: 1, reason: 1, createdAt: -1 }` - Filtered timelines

---

## Federation Flow

### Server A Fetches from Server B

```
1. Server A identifies what content is needed
   - User @alice@serverA follows @bob@serverB
   - User @alice is in group @group123@serverB

2. Server A makes HTTP Signature signed request
   GET https://serverB.com/.well-known/kowloon/pull?authors=@bob@serverB&groups=@group123@serverB

3. Server B verifies signature, checks permissions
   - Verifies @serverA signed the request
   - Checks if @group123 is public or has @serverA members
   - Uses Kowloon.feed.queryItems() to build response

4. Server B returns items
   {
     "@context": "https://www.w3.org/ns/activitystreams",
     "type": "OrderedCollection",
     "orderedItems": [...]
   }

5. Server A processes response
   - Upserts each item into local FeedItems
   - Items are now available for local timeline queries
   - No fan-out needed (queried on-demand)
```

---

## Implementation Files

### Core Methods
- `methods/feed/queryItems.js` - Unified query builder
- `methods/feed/getTimeline.js` - Timeline assembly logic
- `methods/feed/enqueueFanOut.js` - Fan-out job creation

### Routes
- `routes/well-known/kowloon-pull.js` - Federation pull endpoint
- `routes/feed/pull.js` - Local pull endpoint
- `routes/feed/timeline.js` - Unified timeline endpoint

### Schemas
- `schema/FeedItems.js` - Canonical object storage (added `group`, `event` fields)
- `schema/Feed.js` - Per-viewer fan-out rows
- `schema/Group.js` - Group with members Circle
- `schema/Event.js` - Event with attending Circle

### Handlers
- `ActivityParser/handlers/Create/index.js` - Populates group/event in FeedItems

---

## Testing Checklist

### Local Content
- [ ] Create post to @public → appears in FeedItems with to=public
- [ ] Create post to Circle → Feed rows created for members
- [ ] Create post to Group → appears in FeedItems with group=...
- [ ] Create post to Event → appears in FeedItems with event=...

### Timeline Queries
- [ ] GET /feed/timeline (default) → returns Feed rows
- [ ] GET /feed/timeline?circle=... → returns posts by Circle members
- [ ] GET /feed/timeline?author=... → returns posts by author
- [ ] GET /feed/timeline?group=... → returns posts to group (with access check)
- [ ] GET /feed/timeline?event=... → returns posts to event (with access check)
- [ ] GET /feed/timeline?server=... → returns public posts from server

### Federation
- [ ] Server A pulls from Server B with authors param
- [ ] Server A pulls from Server B with groups param
- [ ] Server A pulls from Server B with events param
- [ ] HTTP Signature verification works
- [ ] Access control prevents unauthorized access to private groups/events
- [ ] Remote items upserted into local FeedItems
- [ ] Remote items appear in timeline queries

### Privacy
- [ ] Circle IDs never appear in FeedItems
- [ ] Feed rows only visible to viewer
- [ ] Group/Event membership checked before returning items
- [ ] Cannot query other users' Circle-based content

---

## Future Enhancements

### Near-term
- [ ] Add HTTP Signature signing to remote pull requests
- [ ] Implement Circle timeline remote member pulls
- [ ] Add caching for remote public keys
- [ ] Add rate limiting per requesting domain

### Long-term
- [ ] Implement push-based federation for real-time updates
- [ ] Add webhook notifications for new content
- [ ] Implement distributed cache for FeedItems
- [ ] Add support for content encryption in private Circles
- [ ] Implement federated search across servers

---

## Troubleshooting

### Items not appearing in timelines

**Check 1:** Is the item in FeedItems?
```javascript
db.feeditems.findOne({ id: "post:xyz@domain.com" })
```

**Check 2:** Are group/event fields populated correctly?
```javascript
db.feeditems.findOne({ id: "post:xyz@domain.com" }, { group: 1, event: 1, to: 1 })
```

**Check 3:** Are Feed rows created for Circle-based posts?
```javascript
db.feeds.find({ objectId: "post:xyz@domain.com" })
```

### Remote content not pulling

**Check 1:** Is HTTP Signature verification working?
- Check server logs for signature verification errors
- Verify keyId URL is accessible
- Check clock skew (must be within 5 minutes)

**Check 2:** Are access permissions correct?
- For private groups/events, verify requesting server has members
- Check group.rsvpPolicy or event.rsvpPolicy

**Check 3:** Are items being upserted into FeedItems?
```javascript
db.feeditems.find({ origin: "remote", originDomain: "serverB.com" })
```

### Performance issues

**Check 1:** Are indexes created?
```javascript
db.feeditems.getIndexes()
db.feeds.getIndexes()
```

**Check 2:** Is fan-out worker running?
```javascript
// Check FeedFanOut job status
db.feedfanouts.find({ status: "pending" }).count()
```

**Check 3:** Are remote pulls timing out?
- Default timeout: 10 seconds
- Check network latency to remote servers
- Consider implementing retry logic

---

## Migration Guide

### From Old Feed System

If migrating from an older feed implementation:

1. **Add group/event fields to FeedItems**
   ```javascript
   db.feeditems.updateMany({}, { $set: { group: undefined, event: undefined } })
   ```

2. **Create indexes**
   ```javascript
   db.feeditems.createIndex({ group: 1 })
   db.feeditems.createIndex({ event: 1 })
   ```

3. **Backfill group/event data**
   ```javascript
   // For existing posts, extract group/event from 'to' field
   const items = db.feeditems.find({ to: "audience" })
   items.forEach(item => {
     const source = db.posts.findOne({ id: item.id })
     if (source?.to?.startsWith('group:')) {
       db.feeditems.updateOne({ id: item.id }, { $set: { group: source.to } })
     } else if (source?.to?.startsWith('event:')) {
       db.feeditems.updateOne({ id: item.id }, { $set: { event: source.to } })
     }
   })
   ```

4. **Update client code to use new endpoints**
   - Replace old timeline endpoints with `GET /feed/timeline`
   - Update query parameters to use new format

5. **Test federation pull**
   - Verify HTTP Signature signing/verification
   - Test cross-server content retrieval
   - Monitor for errors in server logs
