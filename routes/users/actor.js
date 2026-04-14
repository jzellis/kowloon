// routes/users/actor.js
// Serve an ActivityPub actor document for GET /users/:id
// when the client requests application/activity+json or application/ld+json.
//
// This is a superset of the normal user profile endpoint:
// it returns an AP actor JSON document with publicKey, inbox, outbox,
// followers, following, and endpoints.sharedInbox.

import { User } from "#schema";
import sanitizeObject from "#methods/sanitize/object.js";
import { getSetting } from "#methods/settings/cache.js";

export default async function actorHandler(req, res) {
  const raw = decodeURIComponent(req.params.id || "");

  // Support bare username (e.g. /users/alice → look up @alice@domain)
  let user = null;
  const domain = getSetting("domain");

  // Try @username@domain format
  if (raw.startsWith("@")) {
    user = await User.findOne({ id: raw, deletedAt: null }).lean();
  }

  // Try as actorId URL (https://domain/users/username)
  if (!user && raw.startsWith("http")) {
    user = await User.findOne({ actorId: raw, deletedAt: null }).lean();
  }

  // Try bare username
  if (!user) {
    const username = raw.replace(/^@/, "").split("@")[0];
    user = await User.findOne({ username, deletedAt: null }).lean();
  }

  if (!user) {
    return res.status(404).json({ error: "Actor not found" });
  }

  const actor = sanitizeObject(user, { objectType: "User" });

  // Serve with AP content type
  res.set("Content-Type", "application/activity+json; charset=utf-8");
  res.status(200).json(actor);
}
