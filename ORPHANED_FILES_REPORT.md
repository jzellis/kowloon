# Orphaned Files Analysis Report

## Summary
This report lists all files in `/methods` and `/routes` directories that are not imported or used anywhere else in the codebase.

**Total files checked:** 235
**Confirmed orphaned files:** See list below

---

## Methods Directory Orphaned Files

### /methods/updateFeed.js
- **Status:** ORPHANED
- **Reason:** Not imported anywhere in the codebase

### /methods/parse/assertTypeFromId.js
- **Status:** ORPHANED
- **Note:** There's a duplicate at /methods/utils/assertTypeFromId.js which IS used

### /methods/activities/parse/index.js
- **Status:** ORPHANED
- **Note:** The individual activity parser files (Accept.js, Follow.js, etc.) are dynamically loaded by their parent, but this index.js itself is not imported

### /methods/bookmarks/index.js
- **Status:** ORPHANED
- **Exports:** get, buildTree, list functions
- **Note:** Individual files are imported directly, not through this index

### /methods/circles/index.js
- **Status:** ORPHANED
- **Note:** Individual method files are imported directly

### /methods/files/index.js
- **Status:** ORPHANED
- **Note:** Individual method files are imported directly

### /methods/files/StorageAdapter/StorageManager.js
- **Status:** ORPHANED

### /methods/files/StorageAdapter/StorageAdapter.js
- **Status:** ORPHANED

### /methods/files/StorageAdapter/adapters/azure.js
- **Status:** ORPHANED

### /methods/files/StorageAdapter/adapters/local.js
- **Status:** ORPHANED

### /methods/files/StorageAdapter/adapters/gcs.js
- **Status:** ORPHANED

### /methods/files/StorageAdapter/adapters/s3.js
- **Status:** ORPHANED

### /methods/invites/index.js
- **Status:** ORPHANED

### /methods/posts/index.js
- **Status:** ORPHANED

### /methods/reacts/index.js
- **Status:** ORPHANED

### /methods/replies/index.js
- **Status:** ORPHANED

### /methods/query/index.js
- **Status:** ORPHANED
- **Note:** Appears to be unused utility

### /methods/timeline/index.js
- **Status:** ORPHANED

### /methods/outbox/index.js
- **Status:** ORPHANED

### /methods/outbox/process.js
- **Status:** ORPHANED

### /methods/federation/verifyRemoteUser.js
- **Status:** ORPHANED
- **Note:** Has a comment indicating it was moved from /methods/auth/

### /methods/federation/pullFromServer.js
- **Status:** ORPHANED

### /methods/feeds/forViewer.js
- **Status:** ORPHANED

---

## Routes Directory Orphaned Files

### /routes/bookmarks/id.js
- **Status:** ORPHANED
- **Note:** routes/bookmarks/index.js exists but doesn't import this file

### /routes/bookmarks/collection.js
- **Status:** ORPHANED
- **Note:** routes/bookmarks/index.js exists but doesn't import this file

### /routes/middleware/rateLimiter.js
- **Status:** ORPHANED
- **Note:** Rate limiting middleware that isn't currently used

### /routes/posts/collection-feedcache.js
- **Status:** ORPHANED
- **Note:** Appears to be an alternative feed cache implementation

### /routes/posts/id-feedcache.js
- **Status:** ORPHANED
- **Note:** Appears to be an alternative feed cache implementation

### /routes/utils/preview.js
- **Status:** ORPHANED

### /routes/utils/makeGetById.js
- **Status:** ORPHANED

### /routes/well-known/upload.js
- **Status:** ORPHANED
- **Note:** routes/well-known/index.js exists but doesn't import this file

---

## Files That Are NOT Orphaned (False Positives from Initial Analysis)

These files were initially flagged but are actually imported:

- routes/federation/auth/start.js - Imported by routes/federation/index.js
- routes/federation/auth/finish.js - Imported by routes/federation/index.js
- routes/federation/pull/client.js - Imported by routes/federation/index.js
- routes/federation/pull/post.js - Imported by routes/federation/index.js
- routes/circles/members/index.js - Imported by routes/circles/index.js
- routes/groups/members/index.js - Imported by routes/groups/index.js
- routes/events/invited/index.js - Imported by routes/events/index.js
- routes/events/attending/index.js - Imported by routes/events/index.js

---

## Recommendations

1. **Safe to Remove:** Files that are clearly unused and have no references
   - `/methods/updateFeed.js`
   - `/methods/parse/assertTypeFromId.js` (duplicate exists in utils/)
   - `/methods/query/index.js`
   - `/routes/utils/preview.js`
   - `/routes/utils/makeGetById.js`
   - `/routes/middleware/rateLimiter.js`

2. **Review Before Removing:** Files that might be work-in-progress or future features
   - Storage adapter files (azure, gcs, s3, local)
   - Feed cache implementations
   - `/methods/federation/pullFromServer.js`
   - `/methods/federation/verifyRemoteUser.js`

3. **Index Files:** Many index.js files that aggregate exports but aren't imported themselves
   - These might be intentional for future use or documentation
   - Consider if they serve a purpose for the codebase organization

---

## Total Orphaned Files: 31

**Methods:** 23 files
**Routes:** 8 files
