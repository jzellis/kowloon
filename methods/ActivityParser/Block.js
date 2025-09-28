// Block.js (refactored)
import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";
import parseId from "../parseId.js"; // keep if other callers rely on it

// Normalize to canonical "@user@host" (accepts string or { id })
function canon(ref) {
  if (!ref) return null;
  if (typeof ref === "string") {
    return ref.startsWith("@") ? ref : ref.includes("@") ? `@${ref}` : null;
  }
  if (typeof ref === "object" && ref.id) return canon(ref.id);
  return null;
}

// Extract host from canonical "@user@host"
function hostFromCanonical(canonicalId) {
  if (!canonicalId?.startsWith("@")) return null;
  const at2 = canonicalId.indexOf("@", 1);
  if (at2 === -1) return null;
  return canonicalId.slice(at2 + 1);
}

// Build canonical user URL: https://host/users/%40user%40host
function userUrl(canonicalId) {
  const host = hostFromCanonical(canonicalId);
  if (!host) return null;
  return `https://${host}/users/${encodeURIComponent(canonicalId)}`;
}

export default async function Block(activity) {
  // self-address: keep this activity private/local
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;

  // Load actor
  const me = await User.findOne({ id: activity.actorId })
    .select("id profile.name blocked")
    .lean();
  if (!me) {
    activity.error = new Error("Actor not found");
    activity.summary = "Block failed: actor not found.";
    return activity;
  }

  // Normalize target
  const targetId = canon(activity.target) || canon(activity.object);
  if (!targetId) {
    activity.error = new Error("Invalid target");
    activity.summary = "Block failed: invalid target.";
    return activity;
  }
  if (targetId === me.id) {
    activity.error = new Error("Cannot block yourself");
    activity.summary = "Block failed: you cannot block yourself.";
    return activity;
  }

  // Resolve target (local or remote) for nicer summary (no mutation)
  const target = await getUser(targetId); // may return null; that's okay for summary
  const targetName = target?.profile?.name || target?.username || targetId;
  const meName = me.profile?.name || "You";

  // Ensure a "blocked" circle exists (your schema already references user.blocked)
  // If your app guarantees it exists, this findOneAndUpdate will still be safe.
  const blockedCircleId = me.blocked;
  if (!blockedCircleId) {
    activity.error = new Error("Blocked circle not configured for actor");
    activity.summary = "Block failed: no blocked circle found.";
    return activity;
  }

  // Add to blocked circle (idempotent)
  // Store minimal member object for compatibility (id + optional name/icon)
  const memberDoc = {
    id: targetId,
    name: target?.profile?.name,
    icon: target?.profile?.icon,
    // URLs are optional; if you keep them, ensure correct encoding:
    url: userUrl(targetId),
    inbox: `${userUrl(targetId)}/inbox`,
    outbox: `${userUrl(targetId)}/outbox`,
  };

  await Circle.findOneAndUpdate(
    { id: blockedCircleId, actorId: me.id },
    { $addToSet: { members: memberDoc } },
    { upsert: false, new: true }
  );

  // Optional: removing the blocked user from ALL of the actor's other circles (idempotent).
  // This ensures they won't appear anywhere else in the UI.
  await Circle.updateMany(
    { actorId: me.id, id: { $ne: blockedCircleId }, members: targetId },
    { $pull: { members: targetId } }
  );
  await Circle.updateMany(
    { actorId: me.id, id: { $ne: blockedCircleId }, "members.id": targetId },
    { $pull: { members: { id: targetId } } }
  );

  activity.summary = `${meName} blocked ${targetName}.`;
  activity.objectId = targetId;
  activity.object = {
    actorId: me.id,
    targetId,
    state: "blocked",
    circle: blockedCircleId,
  };

  // IMPORTANT: no outbound federation/notification by design.
  return activity;
}
