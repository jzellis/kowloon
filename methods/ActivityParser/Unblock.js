// Unblock.js (refactored; canonical IDs, idempotent, no federation)
import { User, Circle } from "../../schema/index.js";
import getUser from "../getUser.js";

function canon(ref) {
  // Accept "@user@host", "user@host", or { id }
  if (!ref) return null;
  if (typeof ref === "string") {
    return ref.startsWith("@") ? ref : ref.includes("@") ? `@${ref}` : null;
  }
  if (typeof ref === "object" && ref.id) return canon(ref.id);
  return null;
}

export default async function Unblock(activity) {
  // keep private/local
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;

  // Actor
  const me = await User.findOne({ id: activity.actorId })
    .select("id profile.name blocked")
    .lean();
  if (!me) {
    activity.error = new Error("Actor not found");
    activity.summary = "Unblock failed: actor not found.";
    return activity;
  }

  // Target
  const targetId = canon(activity.target) || canon(activity.object);
  if (!targetId) {
    activity.error = new Error("Invalid target");
    activity.summary = "Unblock failed: invalid target.";
    return activity;
  }

  // Blocked circle must exist/configured
  if (!me.blocked) {
    activity.error = new Error("Blocked circle not configured for actor");
    activity.summary = "Unblock failed: no blocked circle found.";
    return activity;
  }

  // Circle doc
  const circle = await Circle.findOne({ id: me.blocked, actorId: me.id });
  if (!circle) {
    activity.error = new Error("Blocked circle not found");
    activity.summary = "Unblock failed: blocked circle not found.";
    return activity;
  }

  // Optional: resolve for a nicer summary; OK if null
  const target = await getUser(targetId);
  const targetName = target?.profile?.name || target?.username || targetId;
  const meName = me.profile?.name || "You";

  // Idempotent removal from the blocked circle (supports strings and {id} members)
  const before = circle.members?.length || 0;
  circle.members = (circle.members || []).filter(
    (m) => (m?.id || m) !== targetId
  );
  const after = circle.members.length;

  if (after !== before) {
    await circle.save();
    activity.summary = `${meName} unblocked ${targetName}.`;
  } else {
    activity.summary = `${meName} had already unblocked ${targetName} (no change).`;
  }

  activity.objectId = targetId;
  activity.object = {
    actorId: me.id,
    targetId,
    state: "unblocked",
    circle: circle.id,
  };

  // No remote notifications/federation by design
  return activity;
}
