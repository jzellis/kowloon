Kowloon Activity Verbs — v1 Reference

Endpoint: POST /outbox
Auth: RS256 JWT (issuer https://kwln.org), Authorization: Bearer <token>
Addressing is single-recipient: to accepts exactly one of: @public, @<domain> (e.g. @kwln.org), a Circle ID, Group ID, or Event ID.

Activity Envelope

Every Activity you POST follows this envelope. Fields not needed for a verb can be omitted.

{
  "id": "activity:012345",
  "type": "Create",
  "objectType": "Post",
  "actorId": "@alice@kwln.org",
  "to": "@kwln.org",              // Circle ID | @domain | group:<id>@domain | event:<id>@domain | @public
  "target": "",                   // Verb-specific (see table)
  "summary": "optional",
  "object": { /* varies by objectType */ }
}

ID & Handle Conventions
	•	Users: @username@domain (full actor ID everywhere the API expects a user)
	•	Groups: group:<uuid>@domain
	•	Events: event:<uuid>@domain
	•	Circles: circle:<uuid>@domain
	•	Posts/Pages/etc.: post:<uuid>@domain, page:<uuid>@domain, …

Post object notes (important)
	•	A reply is just a Post whose inReplyTo is set to the parent object ID.
	•	Per-object permissions live on the object: canReply and canReact (Circle/Group/Server ID strings).
	•	The Activity envelope no longer uses replyTo/reactTo.

⸻

Verbs Matrix (canonical)

Verb	ObjectType	Object	To	Target	Permissions	Notes
Accept	none	User ID (subject; defaults to actor for self-accept)		Group/Event ID	Creator/admins (mods for Groups) approve pending; invited users may self-accept	Moves from interested→attending (Event) or requests→members (Group). Removes from invited on self-accept.
Add	none	User ID (to add)		Circle ID	Admin of owning Event/Group (or circle owner)	Idempotent add; bumps circle memberCount.
Block	none	User ID / Server ID / Group ID (blocked entity)			Actor (self) or authorized admin	Enforced via policy/circles; prevents follows/joins/etc.
Create	Bookmark | Event | Group | Page | Post | User	Same as ObjectType (full object)	Circle ID | @domain | Group ID | Event ID		Actor must be authorized to create the resource	A reply is Create→Post with object.inReplyTo (no type:"Reply").
Delete	none	ID of object (Bookmark/Event/Group/Page/Post/React)			Owner or container admin	Usually soft-delete; federates when remote-visible.
Flag	Flag	Flag object (incl. reason, target id)		ID of target (Bookmark/Event/Group/Page/Post/React/User)	Any user	Triggers moderation flow.
Follow	none	User ID / Server ID / Group ID (to follow)		Circle ID (optional)	Actor	If Circle provided, add there; else actor’s following circle.
Invite	none	User ID (invitee)		Event/Group ID	Creator/admins (mods for Groups)	Adds invitee to target’s invited circle.
Join	none			Event/Group ID	Based on rsvpPolicy: open (anyone), invite_only (must be in invited), approval (queued)	Queues to interested (Event) or requests (Group); capacity/blocked enforced.
Leave	none			Event/Group ID	Actor must be attending/member	Removes from attending/members; decrements counts.
Mute	none	User ID / Server ID (to mute)			Actor	Local-only visibility control (non-federating).
React	React	React object		Object ID (target)	Actor must be allowed by target’s canReact	Increments reactCount; federates to remote parents.
Reject	none	User ID (subject; defaults to actor for self-decline)		Event/Group ID	Admins/mods (pending); invitee may self-decline; admins may rescind	Removes from requests/interested (pending) or invited (decline).
Remove	none	User ID (to remove)		Circle ID	Admin of owning Event/Group (or circle owner)	Idempotent remove; bumps circle memberCount down.
Reply	Post	Post with inReplyTo set			Actor must be allowed by canReply of parent	Alias of Create→Post with object.inReplyTo.
Undo	none	ID of prior object/activity to undo			Owner/initiator (or authorized admin)	Reverts Follow/React/Delete/etc.; federates as needed.
Unfollow	none	User ID / Server ID / Group ID (to unfollow)		Circle ID (optional)	Actor	If Circle provided, remove only there; else from all actor circles.
Update	Bookmark | Event | Group | Page | Post | User	Updated object (must include id)		Object ID (optional if in object.id)	Owner or container admin	Partial updates allowed; same shapes as Create.
Upload (planned)	File	File		Post ID (optional)	Actor	If Post ID provided, attach file to that Post. Verb exists in set; implementation TBD.


⸻

Minimal Examples

(IDs are illustrative; use your server’s real IDs.)

Accept (admin approves a pending Group join)

{
  "type": "Accept",
  "actorId": "@admin@kwln.org",
  "target": "group:72b1@kwln.org",
  "object": "@josh@kwln.org"
}

Accept (self-accept an Event invite)

{
  "type": "Accept",
  "actorId": "@josh@kwln.org",
  "target": "event:aa55@kwln.org",
  "object": "@josh@kwln.org"
}

Add (put a user in a Circle)

{
  "type": "Add",
  "actorId": "@admin@kwln.org",
  "target": "circle:friends@kwln.org",
  "object": "@michelle@kwln.org"
}

Block (block a remote user)

{
  "type": "Block",
  "actorId": "@josh@kwln.org",
  "object": "@spammer@elsewhere.net"
}

Create → Post (public)

{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@josh@kwln.org",
  "to": "@public",
  "object": {
    "id": "post:99f1@kwln.org",
    "actorId": "@josh@kwln.org",
    type: "Note",   
    "content": "Hello world",
    "canReply": "@kwln.org",
    "canReact": "@kwln.org"
  }
}

Create → Post (reply)

{
  "type": "Create",
  "objectType": "Post",
  "actorId": "@josh@kwln.org",
  "to": "@kwln.org",
  "object": {
    "id": "post:abcd@kwln.org",
    "actorId": "@josh@kwln.org",
    type: "Reply",
    "inReplyTo": "post:parent@remote.tld",
    "content": "I agree",
    "canReply": "@kwln.org",
    "canReact": "@kwln.org"
  }
}

Delete (a post)

{
  "type": "Delete",
  "actorId": "@josh@kwln.org",
  "object": "post:99f1@kwln.org"
}

Flag (report a user)

{
  "type": "Flag",
  "objectType": "Flag",
  "actorId": "@josh@kwln.org",
  "target": "@spammer@elsewhere.net",
  "object": {
    "reason": "Abuse",
    "details": "DM spam",
    "evidence": ["https://.../screenshot.png"]
  }
}

Follow (remote user, into a specific circle)

{
  "type": "Follow",
  "actorId": "@josh@kwln.org",
  "object": "@alice@remote.social",
  "target": "circle:following@kwln.org"
}

Invite (user to event)

{
  "type": "Invite",
  "actorId": "@admin@kwln.org",
  "target": "event:aa55@kwln.org",
  "object": "@jane@kwln.org"
}

Join (open group)

{
  "type": "Join",
  "actorId": "@josh@kwln.org",
  "target": "group:72b1@kwln.org"
}

Join (approval event → goes to interested)

{
  "type": "Join",
  "actorId": "@jane@kwln.org",
  "target": "event:aa55@kwln.org"
}

Leave (event)

{
  "type": "Leave",
  "actorId": "@josh@kwln.org",
  "target": "event:aa55@kwln.org"
}

Mute (a server)

{
  "type": "Mute",
  "actorId": "@josh@kwln.org",
  "object": "@remote.social"
}

React (like a post)

{
  "type": "React",
  "objectType": "React",
  "actorId": "@josh@kwln.org",
  "target": "post:99f1@kwln.org",
  "object": { "react": "like" }
}

Reject (admin rejects pending group request)

{
  "type": "Reject",
  "actorId": "@admin@kwln.org",
  "target": "group:72b1@kwln.org",
  "object": "@jane@kwln.org"
}

Remove (user from a circle)

{
  "type": "Remove",
  "actorId": "@admin@kwln.org",
  "target": "circle:friends@kwln.org",
  "object": "@michelle@kwln.org"
}

Reply (alias of Create→Post with inReplyTo)

{
  "type": "Reply",
  "objectType": "Post",
  "actorId": "@josh@kwln.org",
  "to": "@kwln.org",
  "object": {
    "id": "post:abcd@kwln.org",
    "actorId": "@josh@kwln.org",
    "inReplyTo": "post:parent@remote.tld",
    "content": "Reply via alias",
    "canReply": "@kwln.org",
    "canReact": "@kwln.org"
  }
}

Undo (a previous follow)

{
  "type": "Undo",
  "actorId": "@josh@kwln.org",
  "object": "activity:follow-1234"
}

Unfollow (remove from all circles)

{
  "type": "Unfollow",
  "actorId": "@josh@kwln.org",
  "object": "@alice@remote.social"
}

Update (edit a post)

{
  "type": "Update",
  "objectType": "Post",
  "actorId": "@josh@kwln.org",
  "object": {
    "id": "post:99f1@kwln.org",
    "content": "Edited content",
    "canReply": "@kwln.org",
    "canReact": "@kwln.org"
  }
}

Upload (planned)

{
  "type": "Upload",
  "objectType": "File",
  "actorId": "@josh@kwln.org",
  "target": "post:99f1@kwln.org",
  "object": { "name": "photo.png", "mime": "image/png", "size": 123456 }
}


⸻

Federation Quick Rules (summary)

We federate when the actor is local and any of these is true:
	•	object.inReplyTo points to a remote object
	•	Following/unfollowing/blocking a remote actor/server/group
	•	to/target references a remote Group or Event
	•	Undo/Delete/Invite/Join/Leave affect remote objects or recipients

(Your shouldFederate(activity, localDomain) helper encapsulates the checks.)