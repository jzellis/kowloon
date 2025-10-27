# Kowloon v1.0 -- Activities

_Last updated: 2025‑10‑22_

This document describes the **Activity** model and handlers in Kowloon v1.0. It covers:
- Canonical activity types
- Activity schema
- Addressing & visibility
- Federation & outbox/inbox
- Validation & IDs
- Examples

> **Scope notes**
> - v1.0 supports **exactly** the types below; adding new types requires code changes.
> - `Announce` and `Register` are **not supported.**
> - `Upload` is **planned** but not implemented yet.
> - Addressing fields (`to`, `canReply`, `canReact`) are **single strings** (not arrays).

---

## Canonical Activity Types

Kowloon v1.0 allows *only* these types (case‑sensitive):

- `Accept`
- `Add`
- `Block`
- `Create`
- `Delete`
- `Flag`
- `Follow`
- `Invite`
- `Join`
- `Leave`
- `Mute`
- `React`
- `Reject`
- `Remove`
- `Reply`
- `Undo`
- `Unfollow`
- `Update`
- `Upload` _(planned -- not implemented)_

> ⚠️ Do **not** emit other types in v1.0.

---

## Activity Schema (v1.0)

All Activities conform to this base shape. Fields marked **(required)** must always be present; others are conditional on `type`.

```jsonc
{
  "type": "Follow",                              // (required) one of the canonical types above
  "objectType": "User|Post|Group|Event|Circle",  // (required) the primary object's type
  "actorId": "@admin@example.org",                  // (required) full actor handle (must match auth)
  "object": { … } | "id-string",                 // (required) object payload for NEW objects (no client-provided ids) or an ID string for EXISTING objects
  "target": "id-string",                         // (optional) target ID (e.g., circle/group/event)
  "summary": "optional human summary",           // (optional)
  "to": "@public|@example.org|circle:…|group:…|event:…",    // (optional) **single string**
  "canReply": "@public|@example.org|circle:…|group:…|event:…",// (optional) **single string**
  "canReact": "@public|@example.org|circle:…|group:…|event:…",// (optional) **single string**
  "federate": true,                              // (optional) hint to send to outbox
  "createdAt": "2025-10-22T12:34:56.000Z",       // (server-set)
  "updatedAt": "2025-10-22T12:34:56.000Z"        // (server-set via Mongoose timestamps)
}
```

### Field notes
- **`actorId`**: must equal the authenticated actor (derived from JWT). Use full handle like `@user@domain`.
- **`object`**:
  - For **new objects** (e.g., `Create` a Post), submit fields **without** an `id`; the server assigns IDs.
  - For **existing objects**, submit an **ID string** (local/remote) or, for `Follow`, `{ actorId: "@user@domain" }`.
  - For `Follow`, the `object` is a `User` (ID string or `{actorId}` convenience form).
- **`target`**: used by verbs like `Add`/`Remove` (e.g., add a member to a `Circle`) or group/event membership verbs.
- **Addressing** (`to`, `canReply`, `canReact`): single string each. See rules below.
- **`federate`**: explicit flag to push to the Outbox for federation when applicable.

---

## Object Subtypes

Every object includes a required `object.type` that determines rendering, sorting, and filtering.
Some object types currently have a single subtype that is auto-set by the schema.

| `objectType` | Allowed `object.type` values | Notes |
|---|---|---|
| **Post** | `Note`, `Article`, `Media`, `Link`, `Reply`* | *`Reply` requires `object.inReplyTo` (ID string).* |
| **Bookmark** | `Folder`, `Bookmark` |  |
| **Page** | `Folder`, `Page` |  |
| **Event** | `Event` | _We may add more specific subtypes later._ |
| **Group** | `Group` | _Options may expand later._ |
| **User** | `Person` |  |
| **Circle** | `Circle` | _Only one subtype; currently auto-set by schema on creation._ |

> **Auto-set subtypes**: Circles (→ `Circle`). For `React` Activities, the created reaction object's `type` is fixed to `React` and set server-side.

### Proposed subtype catalogs
_These are **descriptive only** for discovery/search/filtering; they **do not** change permissions or behavior._

#### Event
- Event (default)
- Meetup
- Workshop
- Talk
- Panel
- Performance
- Livestream
- Release
- Exhibit
- Festival
- Screening
- Hackathon
- Game

#### Group
- Group (default)
- Community
- Team
- Organization
- Collective
- Club
- Class
- Committee
- Guild
- Crew

#### Circle
- Circle (default)
- Following
- Followers
- Friends
- Family
- Colleagues
- Favorites
- Muted
- Blocked
- Test

## Addressing & Visibility

### Addressing domains
- **Public**: `to: "@public"` -- visible to anyone.
- **Server‑scoped**: `to: "@example.org"` -- visible to authenticated users on that domain. A user can only address server-wide objects to their *own* server; e.g., `alice@server1.net` can only address `@server1.net` objects, not `@server2.net` or any other server she does not belong to.
- **Circle/Group/Event**: `to: "circle:<id>"`, `group:<id>`, or `event:<id>` -- visible to members only.

> A given Activity may set **at most one** of `to`, `canReply`, `canReact`. Each is a **single string** (no arrays).
> - `to` -- who may **view** the Activity
> - `canReply` -- who may **reply**
> - `canReact` -- who may **react**

Servers enforce masking/redaction on fetch based on viewer + addressing.

---

## Federation & Outbox

- Outbound federation is controlled by a `shouldFederate(activity)` check.
- In v1.0, we treat federation by **queuing Activities to the Outbox**:
  - `POST /outbox` (no `/post`) with `{ activity }` payload.
  - If an entry already exists with the same `activity.id`, we upsert it.

**Auth model for API and federation**
- API uses **RS256 JWT** (issuer: `https://kwln.org`), signed with `settings.privateKey`; verification uses `settings.publicKey`.
- Clients must send `Authorization: Bearer <token>`.
- On load, middleware `attachUser` verifies the token and sets `req.user` (including `actorId`).

**Collections**
- Local Activities are stored in `Activities`.
- Outbound queued items are stored in `Outbox` with the embedded `activity`.

> Pull‑based federation (fetching remote timelines) is supported by request endpoints; masking remains server‑side based on addressing. Invitations and other directed Activities use explicit addressing to remote actors/resources.

---

## Collections & List Shapes

All list endpoints return an ActivityStreams‑style **`OrderedCollection`** envelope:

```jsonc
{
  "totalItems": 123,
  "totalPages": 13,
  "currentPage": 2,
  "firstItem": "activity:…",
  "lastItem": "activity:…",
  "count": 10,
  "items": [ { /* Activity */ }, … ]
}
```

---

## IDs & Validation

- IDs are autogenerated by the server, *not* the client. If an Activity or object specifies its own ID for anything but updates/deletes, it will be ignored.
- Non-User IDs use a prefixed pattern by object type (e.g., `activity:<ksuid>@<domain>` / `circle:<ksuid>@<domain>`). User IDs follow the pattern `@<username>@<domain>`.
- JSON Schema via AJV validates Activities per verb with a shared base schema.
- The incoming Activity validator must accept:
  - `object` as **ID string** _or_ as `{ "actorId": "@user@domain" }` for user references (e.g., `Follow`).

---

## Common Verbs (Behavioral Notes)

### Follow
- `object`: remote or local user (`"@user@domain"` string or `{ "actorId": … }`).
- Side‑effect: add the `object` user to the follower's **`following` Circle** (or to `target` Circle if provided).
- Implementation uses `$push` for ordered history and `memberCount` increment; ensure idempotence checks to avoid duplicates.

### Unfollow
- Mirror of `Follow`: remove the user from the `following` Circle (or from `target`).

### Add / Remove
- Manage membership in a container (`Circle`, `Group`, `Event`).
- **Permissions**: actor must own the Circle or be an admin/mod of the Group/Event.

### Invite / Join / Leave / Accept / Reject
- Standard membership flow on `Group`/`Event`.

### Create / Reply / React / Update / Delete / Undo / Block / Mute / Flag
- Content and moderation primitives; addressing governs visibility and action rights (`canReply`, `canReact`).

> **Note**: `Upload` not implemented yet; plan is for attachments to be uploaded first and referenced by URL(s) in `object` of subsequent `Create` Activities.

---

## Addressing Examples

### Subtype Examples

**Create Post (Note)**
```json
{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@kwln.org",
  "object": { "type": "Note", "content": "Hello world" },
  "to": "@public"
}
```

**Reply to a Post**
```json
{
  "type": "Reply",
  "objectType": "Post",
  "actorId": "@alice@kwln.org",
  "object": { "type": "Reply", "inReplyTo": "post:01HX…", "content": "+1" },
  "to": "@public",
  "canReply": "@public",
  "canReact": "@public"
}
```

**Create Bookmark Folder**
```json
{
  "type": "Create",
  "objectType": "Bookmark",
  "actorId": "@alice@kwln.org",
  "object": { "type": "Folder", "name": "Reading List" },
  "to": "@kwln.org"
}
```

**Create Page**
```json
{
  "type": "Create",
  "objectType": "Page",
  "actorId": "@alice@kwln.org",
  "object": { "type": "Page", "title": "Docs", "body": "…" },
  "to": "@kwln.org"
}
```

### Public Post
```json
{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@example.org",
  "object": { type: "Note", "content": "Hello world" },
  "to": "@public"
}
```

### Server‑only Post
```json
{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@example.org",
  "object": { type: "Article", title: "This is a new post", "content": "Hello world" },
  "to": "@example.org"
}
```

### Circle‑scoped Post
```json
{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@example.org",
  "object":{ type: "Link", title: "Google", href: "https://www.google.com", content: "This is the most popular search engine." }, 
  "to": "circle:01J0…"
}
```

### Follow (object by actor handle)
```json
{
  "type": "Follow",
  "objectType": "User",
  "actorId": "@alice@example.org",
  "object": { "actorId": "@bob@remote.org" }, // This is who the user is following, can be another user, a server (to follow its public feed, or an RSS URL)
  "target": "circle:following@example.org" // This is the circle the followed user/server/feed is being added to; if not specified, the user/server/feed will be added to the user's "following" circle
}
```

### Unfollow (remove from Circle)
```json
{
  "type": "Unfollow",
  "objectType": "User",
  "actorId": "@alice@example.org",
  "object": "@bob@remote.org",
  "target": "circle:following@example.org" // This is the Circle the object user/server/feed is being removed from. If not specified, they're removed from all of the user's Circles
}
```

---

## Routes (selected)

- `POST /outbox` -- enqueue federated Activities via `route()` wrapper (debug ping at `GET /outbox/__ping`).
- `GET  /__routes` -- development route: returns mounted route tree.
- `GET  /users/:id` -- expects full actor handle `@user@domain`. (A local-username convenience may be added later.)

---

## Notes & Pitfalls

- **Single‑string addressing** is easy to break if your seeders still use arrays -- update seeds and validators.
- **Client-supplied IDs are ignored** -- both for `activity.id` and any `object.id` on create; the server always assigns IDs.
- Ensure `attachUser` enforces that **`actorId` equals the authenticated actor**.
- When mutating membership arrays (e.g., `Circle.members`), update counters (`memberCount`) atomically.
- Upserts to `Outbox` should be keyed by `activity.id` to avoid duplicates.
- Avoid introducing unsupported verbs; validation should reject them early.

---

## Changelog
- **2025‑10‑22**: Consolidated v1.0 notes, clarified single‑string addressing, Outbox rules, and verb set.
