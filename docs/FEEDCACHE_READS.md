# FeedCache Read Pattern

**All GET endpoints should read from FeedCache, not original collections.**

FeedCache is the unified, normalized read layer for both local and remote content. It provides:
- Consistent data shape for all object types
- Privacy-preserving audience fields (no circle ID leaks)
- Optimized indexes for reads
- Pre-computed audience policies

## Architecture

```
Write Path:
User creates Post → Post collection → FeedCache → FeedFanOut queue → Feed (per-viewer)

Read Path:
GET /posts → FeedCache (filtered by visibility) → Enrich with capabilities → Return
```

## Core Principles

### 1. **Never read from original collections (Post/Bookmark/Event) in GET endpoints**
- Original collections are the source of truth for **writes**
- FeedCache is the source of truth for **reads**
- This separates write-optimized from read-optimized concerns

### 2. **Apply visibility filtering based on viewer**
```javascript
// Anonymous
{ to: { $in: ["public", "@public"] } }

// Authenticated local user
{ to: { $in: ["public", "@public", "server"] } }

// Authenticated + audience (requires addressedIds)
{ to: { $in: ["public", "@public", "server", "audience"] }, /* + membership check */ }
```

### 3. **Enrich with per-viewer capabilities**
For each item returned, compute:
- `canReply`: boolean (can this viewer reply?)
- `canReact`: boolean (can this viewer react?)
- `grantToken`: optional capability token for remote audience items

### 4. **Never expose circle IDs**
- FeedCache stores audience as enums: `"public"|"followers"|"audience"|"none"`
- For local items: check membership via helpers
- For remote items: use grants/tokens from the remote server

## Implementation Guide

### Example 1: Collection Endpoint (GET /posts)

```javascript
import { FeedCache } from "#schema";
import {
  buildVisibilityFilter,
  buildFollowerMap,
  buildMembershipMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, query, set }) => {
  const viewerId = req.user?.id || null;

  // 1. Build visibility filter
  const filter = buildVisibilityFilter(viewerId);
  filter.objectType = "Post"; // Filter by type

  // 2. Query FeedCache
  const items = await FeedCache.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(20)
    .lean();

  // 3. Build context for capabilities
  const actorIds = [...new Set(items.map((i) => i.actorId))];
  const followerMap = await buildFollowerMap(actorIds);
  const membershipMap = await buildMembershipMap([]); // TODO: addressedIds

  // 4. Enrich with per-viewer capabilities
  const enriched = items.map((item) =>
    enrichWithCapabilities(item, viewerId, {
      followerMap,
      membershipMap,
      grants: {},
      addressedIds: [],
    })
  );

  // 5. Return objects with capabilities
  set("items", enriched.map((i) => ({
    ...i.object, // The full object envelope
    canReply: i.canReply,
    canReact: i.canReact,
  })));
});
```

### Example 2: Single Object Endpoint (GET /posts/:id)

```javascript
import { FeedCache } from "#schema";
import {
  canView,
  buildFollowerMap,
  enrichWithCapabilities,
} from "#methods/feed/visibility.js";

export default route(async ({ req, params, set, setStatus }) => {
  const { id } = params;
  const viewerId = req.user?.id || null;

  // 1. Fetch from FeedCache
  const item = await FeedCache.findOne({
    id,
    deletedAt: null,
    tombstoned: { $ne: true },
  }).lean();

  if (!item) {
    setStatus(404);
    set("error", "Not found");
    return;
  }

  // 2. Check visibility
  const followerMap = await buildFollowerMap([item.actorId]);
  const allowed = await canView(item, viewerId, { followerMap });

  if (!allowed) {
    setStatus(403);
    set("error", "Access denied");
    return;
  }

  // 3. Enrich with capabilities
  const enriched = enrichWithCapabilities(item, viewerId, {
    followerMap,
    membershipMap: new Map(),
    grants: {},
    addressedIds: [],
  });

  // 4. Return object with capabilities
  set("object", enriched.object);
  set("canReply", enriched.canReply);
  set("canReact", enriched.canReact);
});
```

### Example 3: User Timeline (GET /users/:id/posts)

Two cases:

**A) Viewer requesting their own timeline:**
```javascript
// Read from Feed (personalized fan-out)
const items = await Feed.find({ actorId: viewerId })
  .sort({ createdAt: -1 })
  .limit(20)
  .lean();

// Items already have per-viewer canReply/canReact
```

**B) Viewer requesting someone else's timeline:**
```javascript
// Read from FeedCache filtered by author + visibility
const filter = buildVisibilityFilter(viewerId);
filter.actorId = targetUserId; // The author

const items = await FeedCache.find(filter)
  .sort({ publishedAt: -1 })
  .limit(20)
  .lean();

// Enrich with capabilities for the viewer
```

## Visibility Rules

### Anonymous Viewers
- Can see: `to: "public"`
- Cannot see: `to: "server"`, `to: "audience"`

### Authenticated Local Viewers
- Can see: `to: "public"`, `to: "server"`
- Can see `to: "audience"` IF:
  - Local content: viewer is member of addressed circles/groups/events
  - Remote content: viewer has a grant token

### Authenticated Remote Viewers
- Can see: `to: "public"`
- Cannot see: `to: "server"` (local-only surface)
- Can see `to: "audience"` IF:
  - They have a grant token (never check remote circles)

## Capability Evaluation

For each item, compute `canReply` and `canReact` per viewer:

### "public" → always `true`
```javascript
if (capability === "public") return true;
```

### "none" → always `false`
```javascript
if (capability === "none") return false;
```

### "followers" → check if viewer follows author
```javascript
if (capability === "followers") {
  return follows(viewerId, authorId, followerMap);
}
```

### "audience" → depends on origin
```javascript
if (capability === "audience") {
  if (origin === "local") {
    // Check if viewer is in addressed circles/groups/events
    return inLocalAudience(viewerId, addressedIds, membershipMap);
  } else {
    // Check if viewer has a grant token
    return Boolean(grants[viewerId]);
  }
}
```

## Performance Optimization

### 1. Batch follower lookups
```javascript
// Load all users' followings in one query
const followerMap = await buildFollowerMap(actorIds);
```

### 2. Batch membership lookups
```javascript
// Load all circles/groups/events in one query
const membershipMap = await buildMembershipMap(addressedIds);
```

### 3. Use lean() queries
```javascript
// Skip Mongoose hydration for reads
await FeedCache.find(filter).lean();
```

### 4. Add indexes to FeedCache
```javascript
// Already defined in schema
FeedCache.index({ objectType: 1, to: 1, publishedAt: -1 });
FeedCache.index({ actorId: 1, publishedAt: -1 });
```

## TODO: Remote Grants

For remote content with `to: "audience"` or capabilities set to `"audience"`, the remote server should include a grant token proving the viewer is in the audience.

**Flow:**
1. Local server fetches remote object
2. Remote server checks if requestor is in audience
3. If yes, remote includes `grants: { "@viewer@local": true }` in response
4. Local server stores grants with FeedCache entry
5. Local endpoints use grants to evaluate capabilities

**Implementation:**
```javascript
// When fetching remote objects, include grants
const grants = {};
if (remoteResponse.grants) {
  grants[viewerId] = remoteResponse.grants[viewerId];
}

// Store in FeedCache (extend schema)
await FeedCache.updateOne(
  { id: objectId },
  { $set: { grants } }
);

// Use in capability checks
const canReply = evaluateCapability({
  viewerId,
  capability: "audience",
  origin: "remote",
  grants, // ← from FeedCache
});
```

## Migration Path

To migrate existing endpoints:

1. **Replace collection queries**
   ```javascript
   // OLD
   const posts = await Post.find({ to: "@public" });

   // NEW
   const filter = buildVisibilityFilter(viewerId);
   filter.objectType = "Post";
   const posts = await FeedCache.find(filter);
   ```

2. **Add capability enrichment**
   ```javascript
   const followerMap = await buildFollowerMap(actorIds);
   const enriched = items.map(item =>
     enrichWithCapabilities(item, viewerId, { followerMap })
   );
   ```

3. **Update response format**
   ```javascript
   // Return object envelope + capabilities
   set("items", enriched.map(i => ({
     ...i.object,
     canReply: i.canReply,
     canReact: i.canReact,
   })));
   ```

## Benefits

✅ **Uniform data model** - local and remote treated identically
✅ **Privacy-preserving** - no circle IDs ever exposed
✅ **Performance** - optimized indexes and batch queries
✅ **Stable pagination** - FeedCache has stable sort keys
✅ **Separation of concerns** - write-optimized vs read-optimized

## See Also

- `docs/FEED_FANOUT.md` - How Feed and FeedCache work together
- `methods/feed/visibility.js` - Helper functions
- `routes/posts/collection-feedcache.js` - Example collection endpoint
- `routes/posts/id-feedcache.js` - Example single object endpoint
