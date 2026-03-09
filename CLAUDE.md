# Kowloon — Server

Federated social media server. Node.js, Express, MongoDB/Mongoose, ActivityPub-compatible.

## Architecture

### Core Concept: Circles Replace the Social Graph

Kowloon has **no follow/unfollow system**. Instead, users organize people into **Circles** (like contact lists). Adding someone to a circle IS the follow. There are no followers/following counts, no social graph edges.

- **System Circles** (`type: "System"`): Auto-created per user, addressed `to` the user's own ID. All start empty.
  - **Following**: People the user actively reads content from
  - **All Following**: Superset including followed servers and groups
  - **Groups**: Tracks which Groups the user belongs to (members are Group objects, not Users)
  - **Blocked**: Blocked users
  - **Muted**: Muted users
- **User Circles** (`type: "Circle"`): User-created lists (e.g., "Close Friends", "Work")
- **Group Circles** (`type: "System"`): Each Group gets 5 system circles: Admins, Moderators, Members, Blocked, Pending

### Addressing Model

Every object has a `to` field controlling visibility:
- `@public` — visible to everyone, federated
- `@<domain>` (e.g., `@kwln.org`) — server members only
- `<circleId>` — only members of that circle
- `<userId>` — only that user (private/self-only)

Posts also have `canReply` and `canReact` with the same addressing format.

### Object Types

- **User**: `id` = `@username@domain`, `actorId` = `https://domain/users/username`
- **Post**: Types: Note, Article, Link, Media, Event. `id` = `post:<mongoId>@domain`
- **Reply**: Separate model (not a Post). `id` = `reply:<mongoId>@domain`, `target` points to parent
- **React**: `id` = `react:<mongoId>@domain`, `target` points to reacted object, has `emoji` + `name`
- **Circle**: `id` = `circle:<mongoId>@domain`
- **Group**: `id` = `group:<mongoId>@domain`. Has `rsvpPolicy`: open, serverOpen, serverApproval, approvalOnly
- **Bookmark**: `id` = `bookmark:<mongoId>@domain`. Types: Bookmark (has `href` or `target`), Folder (has `parentId`)
- **Page**: `id` = `page:<mongoId>@domain`. Admin-created content pages
- **Notification**: `id` = `notification:<mongoId>@domain`. Types: reply, react, follow, new_post, join_request, join_approved

### Member Subdocument

Generic embedded doc used in Circle.members[]: `{ id, name, inbox, outbox, icon, url, server, lastFetchedAt }`

Works for both User and Group references (e.g., in the Groups system circle, members are Group objects).

## Design Decisions — DO NOT CHANGE

These are settled architectural decisions. Do not deviate from them.

- **Reply is a separate Mongoose model from Post.** It lives in the `replies` collection, has its own schema (`schema/Reply.js`), and its own ActivityParser handler (`ActivityParser/handlers/Reply/index.js`). It is NOT a Post subtype. The Reply handler is self-contained — it does not delegate to Create.
- **Reply.target** links to the parent object's ID (e.g., a Post ID). Replies have `to`, `canReply`, and `canReact` fields but they are always blank (`""`). Visibility is inherited from the parent object. The fields exist for future-proofing only.
- **React is a separate model** with its own `target` field and self-contained handler. Same pattern as Reply.
- **The pattern for target-based handlers (Reply, React)**: Client sends `to: targetId` in the activity. The handler maps `activity.to` → model's `target` field. The handler creates the document, bumps the count on the parent, creates notifications, and handles federation — all without delegating to Create.
- **System circles always start empty.** Users are never members of their own circles (Following, Groups, All Following, Blocked, Muted).
- **No follow/unfollow.** Circles replace the social graph. Adding to a circle IS the follow.

## Key Patterns

### Route Wrapper (`routes/utils/route.js`)

All route handlers use: `route(async ({ req, query, params, body, user, set, setStatus }) => { ... })`

- `set(key, value)` — takes TWO arguments, sets response fields
- `setStatus(code)` — sets HTTP status
- `user` — authenticated user from JWT (null if unauthenticated)
- GET/HEAD/OPTIONS are unauthenticated by default; POST requires auth
- Override with `{ allowUnauth: true }` or `{ allowUnauth: false }`

### Collection Helper (`routes/utils/makeCollection.js`)

Factory for paginated list endpoints: `makeCollection({ model, buildQuery, select, sort, sanitize, ... })`

Returns ActivityStreams OrderedCollection responses.

### ActivityParser Pipeline

`POST /outbox` -> Activity validation -> ActivityParser -> handler (Create, Reply, React, Join, Add, Leave, etc.)

Handlers do: validation, model creation, circle/group membership updates, notifications, federation.

**Important**: Direct `Model.create()` skips: `actor` embed population, feed fan-out, notifications, federation. The `actor` field on Posts must be set manually if creating directly.

### Visibility System (`methods/visibility/`)

- `getViewerContext(userId)` — returns user's circles, groups, blocked lists
- `canSeeObject(object, viewerContext)` — checks if user can see an object based on `to` field
- `buildVisibilityQuery(viewerContext)` — MongoDB query filter for visible objects
- `sanitizeObject(doc)` — strips sensitive fields for API responses

### Settings Cache (`methods/settings/cache.js`)

In-memory Map loaded from Settings collection. Must call `loadSettings()` or `initKowloon()` before use. `getSetting(name)` reads from cache. Schema hooks use `getServerSettings()` which falls back to env vars if cache isn't loaded yet.

## File Structure

```
schema/           — Mongoose models (User, Post, Circle, Group, etc.)
schema/subschema/ — Embedded schemas (Member, Profile, GeoPoint)
routes/           — Express routers, auto-mounted by routes/index.js
routes/utils/     — route(), makeCollection(), makeGetById(), oc.js
methods/          — Business logic organized by domain
ActivityParser/   — Activity processing pipeline
  handlers/       — One handler per activity type (Create, Reply, React, Join, etc.)
workers/          — Background job processors (feedFanOut)
scripts/          — CLI tools (seed.js, seed-test.js, wipe.js)
config/           — Default settings
```

### Route Auto-Mounting

`routes/index.js` scans for subdirectories with `index.js` files. Each directory becomes a route prefix (e.g., `routes/posts/index.js` -> `/posts`). Special cases: `home` -> `/`, `well-known` -> `/.well-known`.

## Schema Imports

```js
import { Post } from "#schema";           // named export
import User from "#schema/User.js";       // or default exports
import * as Models from "#schema/index.js"; // all models
```

The `#schema`, `#methods`, `#kowloon` path aliases are defined in package.json imports.

## Database

MongoDB via Mongoose. Connection URI from env: `MONGO_URI` (or `MONGODB_URI`, `MONGO_URL`, `DATABASE_URL`).

### Testing

- `scripts/seed-test.js` — Deterministic seed: 4 users (alice/bob/carol/dave) with every visibility permutation for circles, groups, posts, bookmarks. Password: `testpass`. Tagged with `meta.runId: "test"`.
- `scripts/seed-test.js --wipe` — Wipe test data then re-seed
- `scripts/seed.js` — Random seed with faker (configurable counts)
- `POST /__test/wipe` — Wipes all collections except settings (non-production only)

## Current State (as of 2026-03-09)

### Working
- User registration + auth (JWT via `jose`, RS256)
- All CRUD via `POST /outbox` + ActivityParser pipeline
- Circle/Group management (create, join, leave, add, remove, block, mute)
- Notifications (create, list, read, unread, dismiss)
- File uploads + authenticated proxy serving (S3/MinIO backend, Kowloon proxy)
- S2S federation (inbox/outbox, HTTP signatures, batch-pull)
- All GET API routes (posts, users, circles, groups, bookmarks, search, notifications)
- Reply handler fully self-contained (creates Reply model, bumps replyCount, notifies author)
- Update handler: authorized profile/post editing with per-type field allowlists
- Delete handler: authorized soft-delete; User deactivation sets `active: false`
- Flag/report: `POST /outbox` with `{ type: "Flag", target, object: { reason } }`
- Admin API (`/admin/*`): full CRUD for users, groups, posts, circles, flagged content, settings, pages, system stats
- Admin invites (`/admin/invites`): create/list/revoke (individual + open link types)
- Rate limiting: `strictRateLimiter` on `POST /auth/login` and `POST /register`
- Security: `npm audit` reports 0 vulnerabilities; critical/high fixed via direct upgrades + npm `overrides`
- NodeInfo 2.0: real user/post counts from DB
- Settings UI metadata: all settings have `ui: { type, label, group, order }` for admin UI rendering

### File Serving Architecture
- Files stored privately in MinIO/S3. Never exposed directly.
- All file access goes through `GET /files/:id` (Kowloon authenticated proxy).
- Thumbnails served via `GET /files/:id?size=<n>` (no separate File records).
- File IDs: `file:<mongoId>@domain` (set by pre-save hook after first `.save()`).
- **Visibility inheritance**: `File.parentObject` stores parent's Kowloon ID. At serve time, `serve.js` resolves the parent's current `to` field → `effectiveTo = parentTo ?? file.to ?? '@public'`. Parent visibility changes automatically propagate.
- Upload flow: two-save pattern — first save triggers pre-save hook to set `file.id`, then set `file.url = https://<domain>/files/${file.id}` and save again.
- `File.thumbnails`: `{ "200": "thumbnails/xxx_200.webp" }` — storage keys, not URLs.
- nginx: `location /files/` has `proxy_buffering off` + 300s timeout for streaming.
- File metadata endpoint: `GET /files/:id/meta`.
- Delete: `DELETE /files/:id` — owner or server admin only; storage delete non-fatal (soft-delete always runs).

### Key implementation notes
- **JWT**: `jose` (pure ESM), not `jsonwebtoken`. Always call `.toObject({ depopulate: true })` before building JWT payload (jose uses `structuredClone`, which fails on Mongoose subdocs).
- **user.circles fields**: nested under `user.circles.following`, `user.circles.blocked`, etc. — NOT top-level.
- **Seeding**: `scripts/seed-test.js` uses HTTP API calls only. Requires server running. `POST /__test/wipe` only works when `NODE_ENV !== "production"`.
- **Settings cache**: `methods/settings/cache.js` in-memory Map. `getSetting(name)` from cache. `getServerSettings()` always falls back to `process.env.DOMAIN` when cache value is falsy.
- **outbox `to/canReact/canReply` injection**: only injected into `activity.object` for non-Update, non-Delete activities (those handlers treat `object` as a patch).
- **FeedItems "audience" visibility**: `FeedItems.to` is a coarse enum (`public`/`server`/`audience`) — no circle IDs stored. For `"audience"` posts, `FeedFanOut` is the authoritative grant: `canView()` checks `FeedFanOut.findOne({ feedItemId, to: viewerId })`. `enrichWithCapabilities()` is async and does the same for `canReply`/`canReact` capability checks.
- **Update/Delete response**: User result always has `password`, `privateKey`, `publicKeyJwk`, `signature` stripped before returning.
- **Admin auth guard**: plain Express `router.use()` middleware in `routes/admin/index.js` — verifies RS256 JWT then calls `isServerAdmin(userId)`.
- **Settings `ui.type === "redacted"`**: write-protected at API level (in addition to `READONLY_FIELDS` set in `routes/admin/settings.js`).

### Client Test Status (as of 2026-03-09)
All 116 tests passing (activities: 33, auth: 13, comprehensive: 38, integration: 32).

Key fixes applied:
- `ActivityParser/activity.schema.js`: `reply:` IDs added to objectId pattern + replyReactRecipient (allows threaded replies)
- `methods/visibility/helpers.js`: owner can always see their own content; empty `to` = server-wide visibility
- `routes/register/index.js`: registration response now includes `following`/`allFollowing`/`blocked`/`muted` circle IDs
- `docker-compose.yml`: `RATE_LIMITING_ENABLED=false` on dev containers for test suites
- **Client field names**: `updatePost` sends `source.content` (not `content`); `updatePost` `to`/`canReply`/`canReact` go in `object` not activity level; `react` uses `postId`/`emoji`; `reply` stores parent in `target` field (not `inReplyTo`)

### TODO
- Email sending (SMTP config exists in settings, no sending code yet)
- Event type / RSVP system (can defer post-alpha)
- Full S2S federation edge case testing
- Remote grants for `canReply`/`canReact` on remote "audience" posts (deferred)

## Batch-Pull Outbox Federation (COMPLETE as of 2026-03-09)

Instead of kwln2 pushing to each kwln1 user's inbox individually, kwln1 batch-pulls all relevant content for its users from kwln2 in one request.

### GET /outbox — S2S batch-pull mode

**Request params (kwln1 → kwln2):**
- `from` — kwln2 user IDs/handles to pull posts from
- `to` — kwln1 user IDs/handles we're requesting on behalf of
- `since` — ISO timestamp of last pull (omit for all time)

**kwln2 query logic:**

`from` entries can be individual users (`@alice@kwln2.local`) or a bare server (`@kwln2.local`).

For **user** `from` entries:
1. `@public` posts by that user → recipients = `to` users who have that user in one of their Circles
2. Circle-addressed posts by that user → recipients = `to` users who are members of that circle

For **server** `from` entries (e.g. `@kwln2.local`):
1. All `@public` posts from that server → recipients = `to` users who have the bare server ID in one of their Circles

All results filtered by `since`, sorted newest-first, deduplicated.

**Response shape:**
```json
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "OrderedCollection",
  "items": [ ...FeedItem docs... ],
  "recipients": [
    { "itemId": "post:abc@kwln2.local", "to": ["@alice@kwln1.local", "@bob@kwln1.local"] },
    { "itemId": "post:def@kwln2.local", "to": ["@alice@kwln1.local"] }
  ]
}
```

**kwln1 side (`methods/federation/pullFromRemote.js`):**
- Upserts items into local FeedItems collection
- Uses `recipients` map to fan out to each user's feed

## Docker / Local Federation Setup

Two-server federation test environment. Uses Docker Compose with nginx reverse proxy.

- **Domains**: `kwln1.local` → kowloon1, `kwln2.local` → kowloon2
- **Ports**: nginx on 8080 (HTTP) / 8443 (HTTPS); MongoDB on 27018
- **`/etc/hosts`** must have: `127.0.0.1  kwln1.local  kwln2.local`
- **Self-signed cert**: generated once with `bash docker/gen-certs.sh` (stored in `docker/certs/`, gitignored)

### Starting up
```bash
docker compose up -d
# First time only:
bash docker/gen-certs.sh && docker compose restart nginx
TEST_BASE_URL=http://kwln1.local:8080 node scripts/seed-test.js --wipe
TEST_BASE_URL=http://kwln2.local:8080 node scripts/seed-test.js --wipe
```

### Key implementation notes
- nginx uses `resolver 127.0.0.11` + `set $upstream` variable for dynamic DNS resolution (avoids startup failure when app containers aren't ready)
- No fixed IPs — network aliases on nginx container (`kwln1.local`, `kwln2.local`) handle inter-container routing
- `methods/utils/init.js` upserts null/undefined settings on startup (fix for stale DB values)
- `methods/settings/schemaHelpers.js` always falls back to `process.env.DOMAIN` when cache value is falsy

## Federation Status (as of 2026-03-09)

| Test | Status |
|------|--------|
| WebFinger | ✅ |
| Actor fetch | ✅ |
| Login (`POST /auth/login`) | ✅ |
| Create public post | ✅ |
| Add remote user to circle | ✅ Fixed — `getObjectById` unwraps Kowloon API envelope |
| S2S delivery | ✅ Fixed — `shouldFederate.js` + `processFederation` in ActivityParser wired up |
| Reply to remote post | ✅ Works — 202, notification created, replyCount incremented |
| Batch-pull outbox | ✅ Complete — `pullFromRemote` + per-user FeedFanOut fan-out |

All known S2S federation bugs fixed as of 2026-03-07.

## Joplin Integration

Notes are stored in Joplin via Web Clipper API for design docs and specs.
- Port: 41184 (localhost)
- Token: set in env var `JOPLIN_TOKEN`
- Kowloon folder ID: 112f3b6f046a4664ad4733477953ceb4
- Consolidated Client API spec note ID: 1cfd6eaee9b64494a577617d4f9e5847

To read a note: `curl "http://localhost:41184/notes/<id>?token=$JOPLIN_TOKEN&fields=body"`
To list notes in folder: `curl "http://localhost:41184/folders/<folderId>/notes?token=$JOPLIN_TOKEN&fields=id,title"`
