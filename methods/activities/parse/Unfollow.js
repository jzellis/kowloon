// Unfollow.js (remove from one circle if target set; otherwise from all actor's circles)
import { User, Circle } from "#schema";
import getUser from "#methods/users/get.js";
import kowloonId from "#methods/parse/kowloonId.js";

function canon(target) {
  // Accept {id}, "@user@host", or "user@host" → normalize to "@user@host"
  if (!target) return null;
  if (typeof target === "string") {
    if (!target.startsWith("@") && target.includes("@")) return `@${target}`;
    return target;
  }
  if (typeof target === "object" && target.id) return canon(target.id);
  return null;
}

export default async function Unfollow(activity) {
  // self-address to avoid leaking context
  activity.to = activity.actorId;
  activity.replyTo = activity.actorId;
  activity.reactTo = activity.actorId;

  // Resolve actor
  const me = await User.findOne({ id: activity.actorId })
    .select("id profile.name")
    .lean();
  if (!me) throw new Error("Actor not found");

  // Resolve target user ID (canonical)
  const targetId = canon(activity.object) || kowloonId(activity.object);
  if (!targetId) throw new Error("Invalid target");

  // Optionally resolve for a friendlier summary (no mutation, no network if not needed)
  const targetUser = await getUser(targetId);
  const targetName =
    targetUser?.profile?.name || targetUser?.username || targetId;

  let affected = 0;

  if (activity.target) {
    // Remove ONLY from the specified circle (owned by the actor)
    const circle = await Circle.findOne({
      id: activity.target,
      actorId: me.id,
    });
    if (circle) {
      const before = circle.members?.length || 0;
      circle.members = (circle.members || []).filter(
        (m) => (m?.id || m) !== targetId
      );
      const after = circle.members.length;
      if (after !== before) {
        affected = 1;
        await circle.save();
      }
    }
    activity.summary = `${
      me.profile?.name || "You"
    } removed ${targetName} from this circle${affected ? "" : " (no change)"}.`;
  } else {
    // Remove from ALL circles owned by the actor
    // Two passes to handle both storage styles: strings and {id: "..."}
    const res1 = await Circle.updateMany(
      { actorId: me.id, members: targetId },
      { $pull: { members: targetId } }
    );
    const res2 = await Circle.updateMany(
      { actorId: me.id, "members.id": targetId },
      { $pull: { members: { id: targetId } } }
    );

    // res.nModified for Mongoose <6, res.modifiedCount for newer drivers.
    affected =
      (res1?.modifiedCount ?? res1?.nModified ?? 0) +
      (res2?.modifiedCount ?? res2?.nModified ?? 0);

    activity.summary = `${
      me.profile?.name || "You"
    } removed ${targetName} from ${affected} circle${
      affected === 1 ? "" : "s"
    }.`;
  }

  activity.objectId = targetId;
  activity.object = {
    actorId: me.id,
    targetId,
    state: "inactive",
    removedFrom: activity.target || "all",
    circlesAffected: affected,
  };

  // No remote notifications/federation by design
  return activity;
}
