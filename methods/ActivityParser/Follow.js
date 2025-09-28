// Follow.js (refactored per new rule)
// If activity.target is a Circle ID -> add only to that circle
// Else -> add to actor's "Following" circle
import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";

function canon(ref) {
  // Accept "@user@host", "user@host", or { id } -> normalize to "@user@host"
  if (!ref) return null;
  if (typeof ref === "string")
    return ref.startsWith("@") ? ref : ref.includes("@") ? `@${ref}` : null;
  if (typeof ref === "object" && ref.id) return canon(ref.id);
  return null;
}

function encodedUserUrl(canonicalId) {
  // "https://host/users/%40user%40host"
  const at2 = canonicalId.indexOf("@", 1);
  if (at2 === -1) return null;
  const username = canonicalId.slice(1, at2);
  const host = canonicalId.slice(at2 + 1);
  return {
    host,
    actor: `https://${host}/users/${encodeURIComponent(canonicalId)}`,
    inbox: `https://${host}/users/${encodeURIComponent(canonicalId)}/inbox`,
    outbox: `https://${host}/users/${encodeURIComponent(canonicalId)}/outbox`,
  };
}

export default async function Follow(activity) {
  // Keep private/local (no federation by design)
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;

  // Actor
  const me = await User.findOne({ id: activity.actorId })
    .select("id profile.name following")
    .lean();
  if (!me) throw new Error("Actor not found");

  // Target (canonical)
  const targetId = canon(activity.object);
  if (!targetId) throw new Error("Invalid target");
  const target = await getUser(targetId); // optional nicer summary
  const targetName = target?.profile?.name || target?.username || targetId;

  // Decide destination circle:
  // - If activity.target is set -> that circle only
  // - Else -> actor's "following" circle
  const destCircleId = activity.target || me.following;
  if (!destCircleId) throw new Error("No destination circle configured");

  // Ensure the circle belongs to the actor
  const circle = await Circle.findOne({ id: destCircleId, actorId: me.id })
    .select("id")
    .lean();
  if (!circle) throw new Error("Circle not found or not owned by actor");

  // Build member shape (works even if your schema stores strings; $addToSet on objects uses object equality)
  const urls = encodedUserUrl(targetId) || {};
  const memberDoc = {
    id: targetId,
    serverId: `@${urls.host || targetId.split("@").slice(2).join("@")}`, // best-effort label like "@host.tld"
    name: target?.profile?.name,
    icon: target?.profile?.icon,
    url: urls.actor,
    inbox: urls.inbox,
    outbox: urls.outbox,
  };

  // Add idempotently
  await Circle.findOneAndUpdate(
    { id: destCircleId, actorId: me.id },
    { $addToSet: { members: memberDoc } },
    { new: true }
  );

  // Summary & return
  activity.summary = `${me.profile?.name || "You"} followed ${targetName} ${
    activity.target ? "in this circle" : "in Following"
  }.`;
  activity.objectId = targetId;
  activity.object = {
    actorId: me.id,
    targetId,
    state: "active",
    circle: destCircleId,
  };

  return activity;
}
