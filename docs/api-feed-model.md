# Kowloon API & Feed Model

**Status: PROPOSED / target design (not yet implemented).** This describes where
we're taking the read API and the feed model, plus the endpoint-by-endpoint
reconciliation to get there. Write path (`POST /outbox`) and S2S federation
(`/inbox`, `GET /outbox`) are unchanged.

---

## 1. The principle: uniform, viewer-scoped collections

Every read endpoint returns exactly what the **authenticated viewer is
privacy-scoped to see** — visibility is the only implicit filter. One rule set
generates the whole surface:

- **`/{type}`** — every item of that type the viewer may see. No separate
  "mine" vs "browse"; it's one collection, scoped by who you are.
- **`/{type}/{id}`** — one item (or 403/404 if not visible). Same path
  regardless of who owns it.
- **`/users/{id}/{type}`** — that user's items of that type, still
  viewer-scoped: the **owner hitting their own id sees all of theirs**; everyone
  else sees only what they're permitted.
- **`/{type}/{id}/{subtype}`** — nested, viewer-scoped
  (`/circles/{id}/posts`, `/groups/{id}/posts`, `/circles/{id}/members`).
- **Sort / filter / discovery** → **query params on the same collection**, never
  a new path. (`/circles/browse` → `/circles?sort=reacts`.)
- **"Mine"** is just `/users/{my-id}/{type}` — no dedicated endpoint. The
  viewer-awareness is implicit in *who is authenticated*, not a `scope` flag.

This is already how `/users/:id/circles` and `/users/:id/bookmarks` behave
today (owner sees all; others privacy-scoped, folder-aware for bookmarks). The
work is standardizing on it everywhere.

---

## 2. The feed model: pulled collections, not a delivered timeline

Kowloon has **no per-user inbox timeline** (the ActivityPub/Mastodon model,
where your home feed is the pile of activities pushed into your personal inbox).
There is no personalized fan-out "my feed." You are always looking at exactly
one **addressable collection you pull**:

| Feed | Endpoint |
|---|---|
| The server firehose | `GET /posts` |
| A specific user's posts | `GET /users/{id}/posts` |
| A specific circle's feed | `GET /circles/{id}/posts` |
| A group's feed | `GET /groups/{id}/posts` |

Federated/remote content enters through **circles** (subscribing to
`@remote.server` or `@remote.user` puts their public posts into a circle feed),
not into your server's `/posts`.

---

## 3. `/posts` is ONE server feed, not two (the fix to current behavior)

**Current (wrong):** the server feed is split into two selectable views —
"Public" and "Server" — the client calls `getServerPosts({ to: 'public' })` and
`getServerPosts({ to: 'server' })` separately, and `FeedFanOut` stores `@public`
and `@server` as distinct rows queried one-at-a-time.

**Target:** one server feed, gated by auth:

- **Logged out** → `/posts` returns **public only**.
- **Logged in** → `/posts` returns **public AND server-only, mixed
  chronologically**.
- Public vs server-only becomes an **optional filter param** (like the
  post-type filter) — e.g. `/posts?visibility=public`. Default = everything the
  viewer can see.

This is a query + UX change, not a data-model change: the FanOut table already
has both `@public` and `@server` rows, and the circle-feed query already does
`to: { $in: ["@public","@server", viewerId] }`. The server-feed query just needs
to include both when authed (public-only when not), and the `FeedViewSelector`'s
two entries collapse into one "Server" + an optional visibility filter.

---

## 4. inbox / outbox: transport, not timeline

The **reader** has no inbox — feeds are pulled collections. But the **server**
still needs its mailboxes, unchanged:

- **`POST /outbox`** — the entire local write pipeline (ActivityParser).
- **`GET /outbox`** — S2S batch-pull (the federation firehose).
- **`/inbox`** — inbound S2S: interactions to your content (replies/reacts),
  group fan-out, HTTP-signature-verified.

Future direction (not part of this reconciliation): as feeds become addressable
pullable collections, federation could move toward "pull the remote feeds my
users subscribe to," shrinking `/inbox` to **interactions/notifications only**
(the one thing pull can't do: telling kwln1 that someone on kwln2 replied to its
post). Content by pull; interactions by push.

---

## 5. Endpoint reconciliation (current → target)

Tags: **keep** / **alias** (thin redirect for DX) / **retire** / **add** /
**change** (semantics shift).

### posts
| Current | Target | Tag |
|---|---|---|
| `GET /posts` split by `to=public\|server` | `GET /posts` = public + server merged (auth-gated), `?visibility=` + `?type=` filters | **change** |
| `GET /posts/:id` | same | keep |
| `GET /users/:id/posts` | same (viewer-scoped) | keep |
| `GET /circles/:id/posts`, `GET /groups/:id/posts` | same | keep |

### circles
| Current | Target | Tag |
|---|---|---|
| `GET /circles` = my circles only | `GET /circles` = all viewer-visible circles (mine + others' public), `?sort=` | **change** |
| `GET /circles/browse` = discover | folded into `GET /circles?sort=reacts` | **retire** |
| `GET /users/:id/circles` | same (mine = `/users/:my-id/circles`) | keep |
| `GET /circles/:id`, `/circles/:id/posts` | same | keep |

### groups
| Current | Target | Tag |
|---|---|---|
| `GET /groups` = viewer-visible groups | same, `?sort=` | keep |
| *(no endpoint; "my groups" derived from Groups system-circle client-side)* | `GET /users/:id/groups` = a user's group memberships, viewer-scoped | **add** |
| `GET /groups/:id`, `/:id/members`, `/:id/pending`, `/:id/posts` | same | keep |
| dead `client.browseGroups()` → `/groups/browse` | already removed (client) | done |

### bookmarks
| Current | Target | Tag |
|---|---|---|
| `GET /bookmarks` = mine | keep (bookmarks are personal, not discoverable) | keep |
| `GET /users/:id/bookmarks` | same (owner all; others visible; folder-aware) | keep |
| `GET /bookmarks/:id` | same | keep |

### pages
| Current | Target | Tag |
|---|---|---|
| `GET /pages`, `GET /pages/:id` | same (viewer-visible; server-authored, no per-user variant) | keep |

### users
| Current | Target | Tag |
|---|---|---|
| `GET /users`, `/lookup`, `/search`, `/:id` | same | keep |
| `/:id/posts`, `/:id/circles`, `/:id/bookmarks` | same | keep |
| — | `/:id/groups` (see groups) | **add** |

---

## 6. Implementation impact (when we build it)

- **Server:** merge public+server in the `/posts` query (auth-gated + optional
  `visibility` filter); change `GET /circles` from mine-only to all-visible +
  `sort`; retire `routes/circles/browse.js`; add `routes/users/groups.js`.
- **Client (`@kowloon/client`):** collapse `getServerPosts({to})` into one call
  with an optional `visibility` filter; fold `browseCircles()` into `getCircles()`
  with `sort`; add `getUserGroups()`; (`browseGroups()` already removed).
- **Apps (mobile + frontend):** `FeedViewSelector` drops the Public/Server split
  into a single "Server" entry with an optional visibility filter (mirroring the
  post-type filter); "My Circles/Groups" point at `/users/:my-id/...`.
- **Not touched:** `POST /outbox`, `GET /outbox`, `/inbox` — write + federation
  transport stay as-is.

Ship server-compatibly (keep old query shapes working as aliases during the
client/app migration), verify against the docker federation env, then retire the
old shapes.
