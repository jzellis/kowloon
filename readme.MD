**Kowloon** is a decentralized social networking and community publishing network. It is currently still in pre-beta development. This is the codebase for the server.

## Requirements

- Node 18 and up
- MongoDB
- AWS or compatible server (for uploaded file storage)

&nbsp;

## Installation

Currently, Kowloon is still in development and not ready for production, but if you want to spin up a server:

1.  Install Node and Mongo on your system
2.  Clone the repo to your local machine
3.  Update the vars in the .env.sample file to match your own MongoDB URL, etc. (Right now things like "ADMIN_PASSWORD" are ignored.)
4.  `npm install`  and `node index.js` and your Kowloon server will be live.

It's been confirmed to run on MacOS Sequoia, Ubuntu 24.05 and Raspberry Pi OS Trixie (based on Debian 13). The current stack runs perfectly well on a Raspberry Pi Zero 2 W, so it shouldn't tax any machine made after about 2008 unduly.

## Usage

## Overview

Kowloon is based on the [ActivityStreams](https://activitystrea.ms/) standard, though it only supports a subset of the entire list of Activities and has some important conceptual and technical differences that separate it from other AS/ActivityPub-based Fediverse networks, such as Mastodon. Kowloon consists of individual servers or "communities" which can operate standalone, but which also serve as "onramps" to the larger federated network. Federation is done through a combination of pull-based and push-based syndication, with certain Activity/Object/address combinations being federated and others being handled internally.

Every object in Kowloon has a **Kowloon ID** and address fields: `to`, `canReply` and `canReact`.

All user interactions with Kowloon (aside from registering with a server as a new user) are done by creating Activities, which is done by POST requests to the user's server's `/outbox` API endpoint. Retrieving data (such as Collections of server objects or the user's own feed) are simple GET requests. There are no PUT, DELETE, PATCH or any other types of requests to Kowloon, and the only POST requests are done to `/outbox`.

Here is a current list of implemented Activities and what they do:

| **Type** | **Purpose** | **Notes** |
| --- | --- | --- |
| **Create** | Create a new object (Post, Page, Event, etc.) | Core of posting; populates /activities and /outbox |
| **Update** | Edit an existing object | Uses object.id to locate and modify |
| **Delete** | Remove an object | Marks object as deleted in DB |
| **Follow** | Follow another user | Adds target to follower’s “following” Circle or a `target` Circle |
| **Unfollow** | Reverse of Follow | Removes user from all of user's Circles or one `target` Circle |
| **Block** | Block another user | Prevents their content from showing up |
| **Mute** | Hide user or object without blocking | Client-level visibility suppression |
| **Join** | Join a Group or Event | Adds actor to members list |
| **Leave** | Leave a Group or Event | Removes actor from members list |
| **Add** | Add another user to a Circle | Requires permission to edit the Circle |
| **Remove** | Remove a user from a Circle | Mirrors Add, same permissions logic |
| **React** | Add a reaction to an object | Stored in Reacts, Undo reverses it |
| **Undo** | Reverse a previous activity (React, Follow, etc.) | Requires target = original activity id |
| **Flag** | Report inappropriate content | Creates a moderation record for admin review |
| **Reply** | Alias of **Create->Reply** Post a reply to another activity/object | Links to parent via replyTo |
| **Accept** | Accept an Invite or Follow request | Creates reciprocal relationship |
| **Reject** | Reject an Invite or Follow request | No-op beyond acknowledgment |
| **Invite** | Invite user to Group or Event |     |

&nbsp;

The following are in the process of being implemented but only have placeholder handlers now:

| **Type** | **Status** | **Notes** |
| --- | --- | --- |
| **Upload** | 🟡 *Planned but not yet implemented* | Will handle media/file uploads via adapter system |

&nbsp;

### Activities

The structure of Kowloon Activities is a modified form of the ActivityStreams standard. Every incoming Activity must have the following fields:

- `type`: The type of Activity or "verb" (see above list of implemented Activity types).
- `actorId`: The Kowloon ID of the user creating the Activity
- `to`: Who the Activity is visible to (can be empty, see below)
- `canReply`: Who can reply to the Activity (can be empty, see below)
- `canReact`: Who can react to the Activity. (can be empty, see below)

&nbsp;

In addition, some activities also have:

- `target`: The target Kowloon ID for `Update, Delete, Block, Mute, Add, Remove, Undo, Flag, Accept, Reject` and `Invite` Activities, as well as optionally for `Follow/Unfollow` activities.
- `objectType`: If the Activity has an `object`, what type of Object it is (which is sometimes different from `object.type`, as we'll see below).
- `object`: If the Activity type is Create, Update, Add, Remove, Follow, Unfollow, Reply, React, Invite, Flag, the actual object of the Activity -- the object it's Creating or the fields that are being Updated, for example.  
    Objects are usually actual Javascript/JSON objects but for some Activities a Kowloon ID string is sufficient, though either a string or an object of the form `{actorId: "<KowloonID>"}` may also be used in these cases.  
    A detailed description of the various object types and required fields is below.

### Kowloon IDs

Each object has a unique Kowloon ID string, which consists of the pattern `type:dbid@domain.tld`. The only exception are servers, which use the pattern `@domain.tld`, and Users, who have the pattern `@username@domain.tld`. So for example, an Activity might have the ID `activity:6900cecf9ca646e97f147dd3@example.org`, while a User might be `@alice@example.org`. This ID is unique for each object and makes retrieval of any object across the federated network extremely easy.

### Address Fields

The three address fields, `to`, `canReply` and `canReact`, determine who can view the object, who can Create a Reply to it (where applicable) and who can React to it (where applicable). Currently, any object can be addressed `to` one of the following recipients:

- `@public`: This means that the item is visible to anyone on any Kowloon server, as well as via the Web (where applicable) for non-logged-in users. It will appear in any applicable Collection or Feed without limitation to any audience.
- `@<server>`: This is for objects that are only visible to logged-in members of the creator's own server, and not members of other servers or the general public. The server ID must match the creator's own server ID. For example, @alice@example.com can address a Post or Circle or Event to @example.com but not @otherexample.com.
- A Circle ID *(ex.* `circle:6900bf19d164eed933307f19@example.org`): This marks the object as only visible to members of the Circle whose ID it's addressed to, or the Circle's creator. It can only be the ID of a Circle belonging to the creator.
- A Group ID (ex. `group:6900bf19d164eed933307f19@example.org)`: This marks the object as being posted to a Group the creator belongs to, whether local or remote. It cannot be a Group the creator doesn't belong to.
- An Event ID (ex. `event:6900bf19d164eed933307f19@example.org)`: This marks the object as being posted to an Event the creator is attending, whether local or remote. It cannot be an Event the creator isn't attending.
- blank: The only person who can see the object is the object's creator.

The same rules apply for `canReply` and `canReact`. Some objects naturally aren't reply-able or react-to-able; in this case, those fields are either blank or set to the same value as the `to` field.

The values of each of the address fields may be different from one another; for example, a Post with `to: "@public", replyTo: "@example.org", canReact: "circle:6900bf19d164eed933307f19@example.org"` can be seen by anyone, but only replied to by members of `@example.org` and only reacted to by members of `circle:6900bf19d164eed933307f19@example.org.`

Under the current implementation, address fields can have only one recipient per field; one cannot address an object to multiple Circles or Groups yet, though this may change in future depending upon user feedback.

## Federation

Push federation only occurs when the Activity’s object, target, or actor is **owned by a remote host** *and* the Activity directly changes or affects that remote resource. Posts addressed to @public are **never pushed**; they are retrieved via pull.

## Federated Activities

| **Activity** | **Federate when…** |
| --- | --- |
| **Create** | The object is created inside a **remote Group or Event** (their server hosts the collection). |
| **Reply** | The replyTo object is hosted on a **remote** server. |
| **React** | The reactTo object is hosted on a **remote** server. |
| **Update** | The object being updated is **remote** and was previously federated. |
| **Delete** | The deleted object is **remote** (send tombstone). |
| **Accept / Reject** | The accepted/rejected request came from a **remote** actor or collection. |
| **Invite** | Either inviting a **remote user** to a local Group/Event, or inviting into a **remote Group/Event**. |
| **Join / Leave** | The Group or Event being joined/left is **remote**. |
| **Add / Remove** | The target collection or object is **remote**. |
| **Undo** | The original Activity being undone was previously federated (e.g., React, Join). |

&nbsp;

### Unfederated Activities

| **Activity** | **Reason** |
| --- | --- |
| **Follow / Unfollow** | Relationship visibility is private; never federate. |
| **Block / Mute** | Local moderation or UX preference. |
| **Flag** | Local when reporting local content; optional federation *only* if reporting a remote object to its host moderators. |
| **Upload** | *Currently not yet fully implemented*; never federate. |
| **Add / Remove** | Circles are local “playlist-like” constructs; never federate membership changes. Logic for parsing Circles related to Event/Group membership are always handled on the Event/Group's home server. |

&nbsp;

# Objects

These are the types of objects in Kowloon aside from Activities (see above). Each one includes both *incoming* and *outgoing* fields: *incoming* fields are what Kowloon expects a new object to have and *outgoing* are what it returns after the object is created.

&nbsp;

## **Activity**

An Activity is the envelope that applies a **verb** (type) to some **object** (objectType + object). Activities are created by an actorId, optionally reference a target, and are addressed using the single-string addressing fields (to, replyTo, reactTo). Activities are what you POST to /outbox and what arrive in /inbox.

**Allowed Activity types (fixed set):**

Accept, Add, Block, Create, Delete, Flag, Follow, Invite, Join, Leave, Mute, React, Reject, Remove, Reply, Undo, Unfollow, Update, Upload


**Incoming Fields** (what clients send; **bold** = required)

- `type`: One of the allowed verbs above (e.g., "Create", "Follow", "Update").
    
- `objectType`: The type of the object the verb acts on (e.g., "Post", "Bookmark", "User", "Group", "Event", "Circle", "Page", "Folder").
    
- `actorId`: The Kowloon ID of the actor performing the Activity (e.g., "@alice@example.org").
    
- `object`: The object of the Activity.
    
    - For **Create**: a minimal/initial embedded object payload (as with your Bookmark example).
        
    - For **Update**: a partial object patch or full replacement (server-side rules decide what’s mutable).
        
    - For **Delete/Undo/React/etc.**: usually a string ID of the target object/activity, or a minimal stub as required by the verb.
        
- `target`: Secondary entity the verb operates *toward* (when applicable).
    
    - Examples: a **Circle** for Follow/Unfollow, a **Group**/**Event** for Join/Leave, an original **Activity ID** for Undo, etc.
- `summary`: Optional human-readable summary of the action.
    
- `to`: Single string audience/visibility. One of:
    
    - "@public", or "@&lt;domain&gt;" (e.g., "@example.org"), or a single **Circle/Group/Event** ID.
- `canReply`: Single string, who is allowed to reply (same addressing rules as to).
    
- `canReact`: Single string, who is allowed to react (same addressing rules as to).
    


**Outgoing Fields** (what the server returns/ stores)

- `id`: The Kowloon ID of the Activity (e.g., "activity:0f3c…@example.org").
    
- `server`: The server ID (e.g., "@example.org").
    
- `url`: Canonical URL of the Activity.
    
- `type, objectType, actorId, object, target, summary, to, replyTo, reactTo`: Echoed/normalized.
    
    - object is often **normalized or populated** (e.g., after Create, it includes the created object with its assigned id, etc.).
- `actor`: Cached profile snapshot of the actor:
    
    - `id, name, icon, inbox, outbox, url, server`
- `createdAt`: Timestamp the Activity was created.
    
- `updatedAt`: Timestamp the Activity was last updated.
    

**Example: Follow Activity**

(Actor follows a remote user and places them into a specific Circle. Addressed to the server.)

**Incoming Activity (POST /outbox)**

```JSON
{
  "type": "Follow",
  "objectType": "User",
  "actorId": "@alice@example.org",
  "object": "@bob@remote.social",
  "target": "circle:following@alice@example.org",
  "summary": "Alice followed Bob",
  "to": "@example.org",
  "replyTo": "@example.org",
  "reactTo": "@example.org"
}
```

**Returned Activity**

```JSON
{
  "id": "activity:3a1c8d7f2e2b4d0b8c7d1a33@example.org",
  "server": "@example.org",
  "url": "https://example.org/activities/activity%3A3a1c8d7f2e2b4d0b8c7d1a33%40example.org",
  "type": "Follow",
  "objectType": "User",
  "actorId": "@alice@example.org",
  "object": {
    "id": "@bob@remote.social",
    "type": "User",
    "url": "https://remote.social/@bob@remote.social",
    "server": "@remote.social"
  },
  "target": "circle:following@alice@example.org",
  "summary": "Alice followed Bob",
  "to": "@example.org",
  "replyTo": "@example.org",
  "reactTo": "@example.org",
  "actor": {
    "id": "@alice@example.org",
    "name": "Alice Lee",
    "icon": "https://example.org/images/alice.png",
    "inbox": "https://example.org/@alice@example.org/inbox",
    "outbox": "https://example.org/@alice@example.org/outbox",
    "url": "https://example.org/@alice@example.org",
    "server": "@example.org"
  },
  "createdAt": "2025-10-29T16:22:11.251Z",
  "updatedAt": "2025-10-29T16:22:11.251Z"
}
```

## Bookmark

A Bookmark is exactly that, a bookmark of a URL that can be remote or local. A Bookmark can be owned by a User, a Server, an Event or a Group. Each bookmark has the following fields (bold fields are required in incoming Create->Bookmark Activities):

**Incoming Fields**

- `type`: Must be "Folder" or Bookmark (I assume I don't need to explain this), defaults to "Bookmark" if not specified
    
- `parentFolder`: The Kowloon ID of the "Folder" Bookmark the Bookmark is a child of
    
- **`actorId`**: the ID of the Bookmark's creator
    
- **`href`**: The URL the Bookmark refers to
    
- `title`: The title of the Bookmark (defaults to the `href` value if not specified)
    
- `tags`: An array of optional tags/hashtags associated with the Bookmark
    
- `image`: The URL of the associated/preview image for the Bookmark
    
- `summary`: A short summary of the Bookmark
    
- `source`: The full text of the Bookmark's description
    
    - `mediaType`: can be "text/plain", "text/markdown" or "text/HTML", depending on the format used by the client editor
    - `content`: The content of the Bookmark's description as plaintext, Markdown or HTML
- `target`: If the bookmark links to a Kowloon object, the ID of the object it links to (not required)
    
- `to`: see above
    
- **`canReply`**: see above (but not applicable to Bookmarks, can be left blank)
    
- **`canReact`**: (same)
    

**Outgoing Fields**

- `id`: The Kowloon ID of the created Bookmark
- `server`: The Kowloon ID of the Bookmark's server (i.e. "@example.org")
- `url`: The URL where the Bookmark resides
- `actor`: A cached version of the creator's profile:
    - `id`: the creator's Kowloon ID
    - `name`: the creator's full name (i.e. "Alice Lee")
    - `icon`: The URL of the creator's avatar
    - `inbox`: The URL of the creator's inbox
    - `outbox`: The URL of the creator's outbox
    - `url`: The URL of the creator's profile
    - `server`: The Kowloon ID of the creator's home server (i.e. "@example.org")
- `body`: The HTML formatted, sanitized version of source.content
- `createdAt`: The Date object timestamp of when the Bookmark was created
- `updatedAt`: the Date object timestamp of when the Bookmark was last updated

Example: Create->Bookmark Activity  


```JSON
{
    type: "Create",
    objectType: "Bookmark",
    actorId: "@alice@example.org",
    object: {
        type: "Bookmark",
        actorId: "@alice@example.org",
        href: "https://www.wikipedia.org",
        title: "Wikipedia",
        summary: "A free encyclopedia",
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Logo_Wikipedia.svg/1200px-Logo_Wikipedia.svg.png",
        source: {
            mediaType: "text/html",
            content: "<p>Wikipedia is a free encyclopedia used by billions around the world.</p><p>It's my favorite website.</p>"
        },
        to: "@public",
        canReply: null,
        canReact: null
    }
}

```

**Returned Bookmark**

```JSON
{
    id: "bookmark:6900ced19ca646e97f1490ca@example.org",
    server: "@example.org",
    type: "Bookmark",
    actorId: "@alice@example.org",
    href: "https://www.wikipedia.org",
    title: "Wikipedia",
    summary: "A free encyclopedia",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Logo_Wikipedia.svg/1200px-Logo_Wikipedia.svg.png",
    source: {
        mediaType: "text/html",
        content: "<p>Wikipedia is a free encyclopedia used by billions around the world.</p><p>It's my favorite website.</p>"
    },
    to: "@public",
    canReply: null,
    canReact: null,
    actor: {
        id: "@alice@example.org",
        name: "Alice Lee",
        icon: "https://example.org/images/alice.png",
        inbox: "https://example.org/@alice@example.org/inbox",
        outbox: "https://example.org/@alice@example.org/outbox",
        url: "https://example.org/@alice@example.org",
        server: "@example.org"
    },
    url: "https://example.org/bookmarks/bookmark%3A6900ced19ca646e97f1490ca%40example.org",
    createdAt: "2025-10-28T14:10:25.736+00:00",
    updatedAt: "2025-10-28T14:10:25.736+00:00"    
}
```

&nbsp;

# **Circle**

A Circle is a user-owned list used to organize other users (e.g., “Following,” “Friends”). Circles are owned by a single user; membership is typically managed with Add / Remove Activities, though a new Circle can be created empty. The schema tracks basic metadata, an optional icon, membership, and engagement counts.

**Incoming Fields** (for Create -> Circle; **bold** = required)

- `type`: Must be "Circle"; defaults to "Circle" if omitted.
    
- `actorId`: The Circle owner’s Kowloon ID (e.g., "@alice@example.org").
    
- **`name`**: Human-readable name (e.g., “Following”).
    
- `summary`: Optional short description.
    
- `icon`: Optional icon URL; a server default is applied if not provided.
    
- `members`: Optional initial member list (usually managed later via Add/Remove). Each member has:
    
    - `id` (**required**), `name, inbox, outbox, icon, url, server`.
- `to`: Single-string audience for the Circle object metadata (e.g., "@example.org" or "@public").
    
- `canReply`: Single string; typically left blank for Circles.
    
- `canReact`: Single string; typically left blank for Circles.
    

**Outgoing Fields** (returned/stored)

- `id`: Assigned on create, format circle:&lt;mongoId&gt;@&lt;domain&gt;.
    
- `server`: The hosting server’s actor ID; set from server settings on create.
    
- `url`: Canonical Circle URL (e.g., https://&lt;domain&gt;/circles/&lt;encoded-id&gt;).
    
- `type, name, actorId, summary, icon, members, to, canReply, canReact`: Normalized echoes of input.
    
- `memberCount`: Integer count of members.
    
- `actor`: Cached profile snapshot of the owner (id, name, icon, inbox, outbox, url, server).
    
- `replyCount, reactCount, shareCount`: Engagement counters maintained by the server.
    
- `deletedAt, deletedBy`: Soft-delete metadata (null when active).
    
- `lastFetchedAt`: For federation/refresh bookkeeping.
    
- `createdAt, updatedAt`: Timestamps.
    

&nbsp;

**Incoming**

```JSON
{
  "type": "Create",
  "objectType": "Circle",
  "actorId": "@alice@example.org",
  "object": {
    "type": "Circle",
    "actorId": "@alice@example.org",
    "name": "Following",
    "summary": "People I follow from all servers",
    "icon": "https://example.org/images/following.png",
    "members": [],
    "to": "@example.org",
    "canReply": "",
    "canReact": ""
  }
}
```

**Returned**

```JSON
{
  "id": "circle:8b2f1e0d9a1344a5b6c7d8e9@example.org",
  "server": "@example.org",
  "type": "Circle",
  "name": "Following",
  "actorId": "@alice@example.org",
  "summary": "People I follow from all servers",
  "icon": "https://example.org/images/following.png",
  "members": [],
  "memberCount": 0,
  "to": "@example.org",
  "canReply": "",
  "canReact": "",
  "actor": {
    "id": "@alice@example.org",
    "name": "Alice Lee",
    "icon": "https://example.org/images/alice.png",
    "inbox": "https://example.org/@alice@example.org/inbox",
    "outbox": "https://example.org/@alice@example.org/outbox",
    "url": "https://example.org/@alice@example.org",
    "server": "@example.org"
  },
  "url": "https://example.org/circles/circle%3A8b2f1e0d9a1344a5b6c7d8e9%40example.org",
  "replyCount": 0,
  "reactCount": 0,
  "shareCount": 0,
  "deletedAt": null,
  "deletedBy": null,
  "lastFetchedAt": null,
  "createdAt": "2025-10-29T16:40:12.005Z",
  "updatedAt": "2025-10-29T16:40:12.005Z"
}
```

# **Event**

An Event represents a scheduled gathering with start/end time, optional description, and RSVP policy. Events are created by a user (actorId) and (when local) automatically get their own administrative/member Circles (Admins, Invited, Moderators, Interested, Attending, Blocked). These Circles are stored as **IDs** on the Event and their counts are tracked on the Event for fast UI reads.

**Incoming Fields** (for Create -> Event; **bold** = required)

- type: Must be "Event"; defaults to "Event" if omitted.
    
- **actorId**: The creator’s Kowloon ID (e.g., "@alice@example.org").
    
- title: Short title of the event.
    
- description: Longer plain/HTML/MD text (server stores as a string).
    
- **startTime**: ISO date-time for start.
    
- endTime: ISO date-time for end (optional).
    
- timezone: IANA zone string (e.g., "Europe/London").
    
- location: A GeoPoint object (see subschema), optional.
    
- ageRestricted: Boolean, default false.
    
- href: External link for more info/tickets (optional).
    
- rsvpPolicy: One of "invite_only" | "open" | "approval", default "invite_only".
    
- capacity: Max attendees; 0 = unlimited (default).
    
- to: Single-string audience/visibility (e.g., "@public" or "@example.org").
    
- canReply: Single string; who may reply (often left blank or set to the server/event).
    
- canReact: Single string; who may react.
    

> Note: The six membership Circles (admins, invited, moderators, interested, attending, blocked) are **created/ensured by the server** for local events; clients don’t need to send them on create. The creator is auto-seeded into Admins (and Attending), and counts are updated.

**Outgoing Fields** (returned/stored)

- id: Stable global ID event:&lt;\_id&gt;@&lt;domain&gt;.
    
- server: Hosting server’s actor ID (e.g., "@example.org").
    
- url: Canonical URL, plus inbox/outbox URLs for the event.
    
- type, actorId, title, description, startTime, endTime, timezone, location, ageRestricted, href, rsvpPolicy, capacity, to, canReply, canReact: Normalized echoes.
    
- actor: Cached snapshot of the creator’s profile (id, name, icon, inbox, outbox, url, server).
    
- Membership Circle **IDs** and counts:
    
    - admins, adminCount
        
    - invited, invitedCount
        
    - moderators
        
    - interested, interestedCount
        
    - attending, attendingCount
        
    - blocked, blockedCount
        
        *(all circle fields are IDs; counts denormalized on the event)*
        
- Engagement counts: replyCount, reactCount, shareCount.
    
- Soft-delete: deletedAt, deletedBy.
    
- createdAt, updatedAt.
    

&nbsp;

**Incoming**

```JSON
{
  "type": "Create",
  "objectType": "Event",
  "actorId": "@alice@example.org",
  "object": {
    "type": "Event",
    "actorId": "@alice@example.org",
    "title": "Kowloon Dev Meetup",
    "description": "A casual evening to discuss ActivityStreams, federation, and UI plans.",
    "startTime": "2025-11-05T18:30:00.000Z",
    "endTime": "2025-11-05T21:00:00.000Z",
    "timezone": "Europe/London",
    "href": "https://example.org/events/kowloon-dev-meetup",
    "rsvpPolicy": "open",
    "capacity": 50,
    "to": "@public",
    "canReply": "@example.org",
    "canReact": "@public"
  }
}
```

**Returned**

```JSON
{
  "id": "event:7f0bb6a9d2d0486c9f2c1a34@example.org",
  "server": "@example.org",
  "type": "Event",
  "actorId": "@alice@example.org",
  "title": "Kowloon Dev Meetup",
  "description": "A casual evening to discuss ActivityStreams, federation, and UI plans.",
  "startTime": "2025-11-05T18:30:00.000Z",
  "endTime": "2025-11-05T21:00:00.000Z",
  "timezone": "Europe/London",
  "ageRestricted": false,
  "href": "https://example.org/events/kowloon-dev-meetup",
  "url": "https://example.org/events/event%3A7f0bb6a9d2d0486c9f2c1a34%40example.org",
  "inbox": "https://example.org/events/event%3A7f0bb6a9d2d0486c9f2c1a34%40example.org/inbox",
  "outbox": "https://example.org/events/event%3A7f0bb6a9d2d0486c9f2c1a34%40example.org/outbox",
  "rsvpPolicy": "open",
  "capacity": 50,
  "to": "@public",
  "canReply": "@example.org",
  "canReact": "@public",

  "actor": {
    "id": "@alice@example.org",
    "name": "Alice Lee",
    "icon": "https://example.org/images/alice.png",
    "inbox": "https://example.org/@alice@example.org/inbox",
    "outbox": "https://example.org/@alice@example.org/outbox",
    "url": "https://example.org/@alice@example.org",
    "server": "@example.org"
  },

  "admins": "circle:fa21a9...@example.org",
  "adminCount": 1,
  "invited": "circle:2d77c1...@example.org",
  "invitedCount": 0,
  "moderators": "circle:4bd8ee...@example.org",
  "interested": "circle:9a0c55...@example.org",
  "interestedCount": 0,
  "attending": "circle:5e3a44...@example.org",
  "attendingCount": 1,
  "blocked": "circle:8cd3f9...@example.org",
  "blockedCount": 0,

  "replyCount": 0,
  "reactCount": 0,
  "shareCount": 0,

  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2025-10-29T16:55:40.212Z",
  "updatedAt": "2025-10-29T16:55:40.212Z"
}
```

&nbsp;

# **Group**

A Group is a community owned by a single creator (actorId). Local Groups automatically get management/member Circles (Admins, Moderators, Members, Invited, Blocked, Requests). The Group stores **IDs** of those Circles plus denormalized counts for fast reads. Addressing defaults (to, canReply, canReact) live on the Group for visibility and interaction policy.

**Incoming Fields** (for Create → Group; **bold** = required)

- type: Must be "Group"; defaults to "Group" if omitted.
    
- **actorId**: Creator’s Kowloon ID (e.g., "@alice@example.org").
    
- name: Human-readable group name.
    
- description: Optional longer blurb.
    
- icon: Optional icon URL; server sets a default if omitted.
    
- location: Optional GeoPoint (subschema).
    
- rsvpPolicy: One of "invite_only" | "open" | "approval", default "invite_only".
    
- to: Single-string audience (e.g., "@public" or "@example.org").
    
- canReply: Single string; who may reply.
    
- canReact: Single string; who may react.
    

> Notes on creation: for **local** groups, the server mints id/url/server/inbox/outbox, sets a default icon, ensures six Circles (admins, moderators, members, invited, blocked, requests), seeds the creator into Admins + Moderators + Members once, and updates memberCount. Remote mirrors skip this.

**Outgoing Fields** (returned/stored)

- id: Global ID group:&lt;\_id&gt;@&lt;domain&gt;.
    
- objectType: "Group".
    
- server: Hosting server’s actor ID (e.g., "@example.org").
    
- url, inbox, outbox: Canonical links.
    
- actorId, actor: Owner’s ID and a cached profile snapshot (if available).
    
- Presentation: name, description, icon, location.
    
- Policy & addressing: rsvpPolicy, to, canReply, canReact.
    
- Circle IDs (owned by this Group):
    
    - admins, moderators, members, invited, blocked, requests (IDs only).
- memberCount: Denormalized size of the **Members** circle.
    
- Engagement counts: replyCount, reactCount, shareCount.
    
- Soft delete: deletedAt, deletedBy.
    
- createdAt, updatedAt.
    

&nbsp;

**Incoming**

```JSON
{
  "type": "Create",
  "objectType": "Group",
  "actorId": "@alice@example.org",
  "object": {
    "type": "Group",
    "actorId": "@alice@example.org",
    "name": "Kowloon Builders",
    "description": "Discussion and updates for the Kowloon project.",
    "rsvpPolicy": "open",
    "to": "@public",
    "canReply": "@example.org",
    "canReact": "@public"
  }
}
```

**Returned**

```JSON
{
  "id": "group:5f2a9d4c7e1042e2b6c1d0aa@example.org",
  "objectType": "Group",
  "server": "@example.org",
  "url": "https://example.org/groups/group%3A5f2a9d4c7e1042e2b6c1d0aa%40example.org",
  "inbox": "https://example.org/groups/group%3A5f2a9d4c7e1042e2b6c1d0aa%40example.org/inbox",
  "outbox": "https://example.org/groups/group%3A5f2a9d4c7e1042e2b6c1d0aa%40example.org/outbox",

  "actorId": "@alice@example.org",
  "actor": {
    "id": "@alice@example.org",
    "name": "Alice Lee",
    "icon": "https://example.org/images/alice.png",
    "inbox": "https://example.org/@alice@example.org/inbox",
    "outbox": "https://example.org/@alice@example.org/outbox",
    "url": "https://example.org/@alice@example.org",
    "server": "@example.org"
  },

  "name": "Kowloon Builders",
  "description": "Discussion and updates for the Kowloon project.",
  "icon": "https://example.org/images/group.png",
  "rsvpPolicy": "open",

  "to": "@public",
  "canReply": "@example.org",
  "canReact": "@public",

  "admins": "circle:f1a2b3c4d5@example.org",
  "moderators": "circle:e6f7a8b9c0@example.org",
  "members": "circle:aa11bb22cc@example.org",
  "invited": "circle:dd33ee44ff@example.org",
  "blocked": "circle:0099aa88bb@example.org",
  "requests": "circle:1122cc33dd@example.org",

  "memberCount": 1,

  "replyCount": 0,
  "reactCount": 0,
  "shareCount": 0,

  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2025-10-29T17:05:24.812Z",
  "updatedAt": "2025-10-29T17:05:24.812Z"
}
```

&nbsp;

Page (*coming soon)*

&nbsp;

# **Post**

A Post is a user-authored piece of content. It can be a short **Note** (default) or other post types (e.g., with a title), may include links (href), images, attachments, tags, and location. Server-side it stores both the raw source (source) and a rendered HTML body, plus denormalized counts and an optional cryptographic signature.

**Incoming Fields** (for Create → Post; **bold** = required)

- type: The post style/type: currently can be "Note", "Article", "Media" or "Link". (Defaults to "Note").
    
- **actorId**: The author’s Kowloon ID (e.g., "@alice@example.org").
    
- title: Optional title (primarily for non-Note types).
    
- summary: Optional summary.
    
- **source**: Raw content payload.
    
    - **content**: The raw text/HTML/Markdown.
        
    - mediaType: "text/html" (default), "text/markdown", or "text/plain".
        
    - contentEncoding: Defaults to "utf-8".
        
- href: If the post is a link-post, the target URL.
    
- image: Featured/preview image URL.
    
- attachments: Array of file objects { filetype, size, url, title?, description? }.
    
- tags: Array of strings.
    
- location: GeoPoint (ActivityStreams-style).
    
- target: If this is a “Link” style, the internal object ID it points at (optional).
    
- inReplyTo: If this is a reply, the ID of the target post/activity.
    
- to: Single-string visibility ("@public", "@domain", or a single Circle/Group/Event ID).
    
- **canReply**: Single string; who may reply (often left blank/server-level).
    
- **canReact**: Single string; who may react.
    

> Server behavior on create/update:

- > Renders body from source based on mediaType (markdown → HTML, html → passthrough, plain → paragraphs).
    
- > Computes wordCount and charCount.
    
- > Recounts replyCount and reactCount from related collections.
    
- > Signs the post with the author’s private key and stores signature (a verify method exists).
    

**Outgoing Fields** (returned/stored)

- id: Minted post:&lt;\_id&gt;@&lt;domain&gt;.
    
- objectType: "Post".
    
- server: Hosting server’s actor ID (e.g., "@example.org").
    
- url: Canonical URL for the post.
    
- actorId, actor: Author ID and cached profile snapshot (if cached).
    
- Presentation/data: type, title, summary, source, body, wordCount, charCount, image, attachments, tags, location, href, target, inReplyTo.
    
- Addressing/policy: to, canReply, canReact.
    
- Counters: replyCount, reactCount, shareCount.
    
- Moderation: deletedAt, deletedBy.
    
- Crypto: signature (binary/base64).
    
- createdAt, updatedAt (timestamps).
    

Incoming

```JSON
{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@example.org",
  "object": {
    "type": "Note",
    "actorId": "@alice@example.org",
    "source": {
      "mediaType": "text/markdown",
      "content": "Had a great time hacking on **Kowloon** tonight. Ship it!"
    },
    "tags": ["devlog", "kowloon"],
    "to": "@public",
    "canReply": "@example.org",
    "canReact": "@public"
  }
}
```

Returned

```JSON
{
  "id": "post:6a90cfe41b5a4d2c9e8f10aa@example.org",
  "objectType": "Post",
  "server": "@example.org",
  "url": "https://example.org/posts/post%3A6a90cfe41b5a4d2c9e8f10aa%40example.org",

  "actorId": "@alice@example.org",
  "actor": {
    "id": "@alice@example.org",
    "name": "Alice Lee",
    "icon": "https://example.org/images/alice.png",
    "inbox": "https://example.org/@alice@example.org/inbox",
    "outbox": "https://example.org/@alice@example.org/outbox",
    "url": "https://example.org/@alice@example.org",
    "server": "@example.org"
  },

  "type": "Note",
  "title": null,
  "summary": null,
  "source": {
    "mediaType": "text/markdown",
    "contentEncoding": "utf-8",
    "content": "Had a great time hacking on **Kowloon** tonight. Ship it!"
  },
  "body": "<p><p>Had a great time hacking on <strong>Kowloon</strong> tonight. Ship it!</p></p>",
  "wordCount": 10,
  "charCount": 61,

  "image": null,
  "attachments": [],
  "tags": ["devlog", "kowloon"],
  "location": null,
  "href": null,
  "target": null,
  "inReplyTo": null,

  "to": "@public",
  "canReply": "@example.org",
  "canReact": "@public",

  "replyCount": 0,
  "reactCount": 0,
  "shareCount": 0,

  "deletedAt": null,
  "deletedBy": null,

  "signature": "BASE64_SIGNATURE_DATA",

  "createdAt": "2025-10-29T17:18:44.301Z",
  "updatedAt": "2025-10-29T17:18:44.301Z"
}
```

**Notes**

- body is derived from source: Markdown is rendered to HTML; HTML passes through; plain text is wrapped into paragraphs. Word/char counts are computed from the HTML-stripped text.
    
- replyCount/reactCount are recomputed by querying Reply/React on the post’s id. shareCount exists on the document for future use.
    
- Posts are signed on save; a verifySignature() helper uses the author’s public key.
    

&nbsp;

# **User**

A User is a Kowloon actor — a person or automated account that can create, follow, post, and participate in federation. Each user owns their own Circles (Following, All Following, Blocked, Muted), has ActivityPub-compatible endpoints (inbox, outbox), and automatically receives public/private keypairs and ActivityPub actor URLs on creation.

**Incoming Fields** (for Create → User; **bold** = required)

- type: Must be "Person", defaults to "Person".
    
- objectType: Must be "User", defaults to "User".
    
- **username**: Unique username (required).
    
- **password**: Plaintext password (bcrypt-hashed on save).
    
- email: Optional email (unique if present).
    
- profile: Object defining user profile data (see below).
    
    - name: Display name.
        
    - description: Short bio.
        
    - icon: Avatar URL.
        
    - location: Optional GeoPoint.
        
    - pronouns: If omitted, defaults to defaultPronouns from Settings.
        
- prefs: Optional preferences object (see below).
    
- to, canReply, canReact: Addressing defaults; typically "@public" or blank.
    

> **Server behavior:**

- > Fills id, actorId, server, domain, url, inbox, outbox.
    
- > Generates a 2048-bit RSA keypair (publicKey/privateKey).
    
- > Creates default Circles (Following, All Following, Blocked, Muted).
    
- > Auto-adds the user to those circles as a member.
    

* * *

**Outgoing Fields** (returned/stored)

- id: Internal Kowloon ID, format @username@domain.
    
- actorId: Canonical ActivityPub actor URL (e.g., https://example.org/users/alice).
    
- server: Server’s actor ID (e.g., "@example.org").
    
- objectType: "User".
    
- type: "Person".
    
- username, email.
    
- profile:
    
    - name, description, icon, location, pronouns.
- prefs:
    
    - defaultPostType, defaultTo, defaultcanReply, defaultcanReact, defaultPostView, defaultCircleView, defaultEditorType, lang, theme.
- inbox, outbox: Canonical URLs.
    
- following, allFollowing, blocked, muted: Circle IDs for those lists.
    
- publicKey, privateKey: PEM-formatted RSA keys (private key is not returned to clients).
    
- publicKeyJwk: Optional structured JWK for interop.
    
- keyRotationAt: Timestamp for last key rotation.
    
- jwksUrl: Server JWKS endpoint.
    
- active: Boolean, default true.
    
- deletedAt: Timestamp if soft-deleted.
    
- feedRefreshedAt: Last time federated feed was refreshed.
    
- meta: { seed, runId, externalId } (internal seeding/test metadata).
    
- createdAt, updatedAt.
    

&nbsp;

**Incoming registration (POST to /register)**

```JSON
{
  "type": "Create",
  "objectType": "User",
  "actorId": "@admin@example.org",
  "object": {
    "type": "Person",
    "objectType": "User",
    "username": "alice",
    "password": "supersecurepassword",
    "email": "alice@example.org",
    "profile": {
      "name": "Alice Lee",
      "description": "Developer and tea enthusiast.",
      "icon": "https://example.org/images/alice.png"
    },
    "to": "@public",
    "canReply": "@public",
    "canReact": "@public"
  }
}
```

Returned

```JSON
{
  "id": "@alice@example.org",
  "actorId": "https://example.org/users/alice",
  "objectType": "User",
  "type": "Person",
  "server": "@example.org",
  "domain": "example.org",
  "jwksUrl": "https://example.org/.well-known/jwks.json",
  "username": "alice",
  "email": "alice@example.org",
  "profile": {
    "name": "Alice Lee",
    "description": "Developer and tea enthusiast.",
    "icon": "https://example.org/images/alice.png",
    "pronouns": "she/her"
  },
  "prefs": {
    "defaultPostType": "Note",
    "defaultTo": "@public",
    "defaultcanReply": "@public",
    "defaultcanReact": "@public",
    "defaultPostView": ["Note", "Article", "Media", "Link"],
    "defaultCircleView": "",
    "defaultEditorType": "html",
    "lang": "en",
    "theme": "light"
  },
  "inbox": "https://example.org/users/alice/inbox",
  "outbox": "https://example.org/users/alice/outbox",
  "following": "circle:abcd1234@example.org",
  "allFollowing": "circle:abcd5678@example.org",
  "blocked": "circle:efgh9012@example.org",
  "muted": "circle:ijkl3456@example.org",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFA...\n-----END PUBLIC KEY-----",
  "keyRotationAt": "2025-10-29T17:40:00.000Z",
  "active": true,
  "deletedAt": null,
  "feedRefreshedAt": null,
  "meta": { "seed": null, "runId": null, "externalId": null },
  "createdAt": "2025-10-29T17:40:00.000Z",
  "updatedAt": "2025-10-29T17:40:00.000Z"
}
```

&nbsp;

*\[More documentation to come!\]*

&nbsp;