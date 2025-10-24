// /ActivityParser/handlers/Unfollow/index.js
import { Circle, User } from "#schema";
import toMember from "#methods/parse/toMember.js";

export default async function Unfollow(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Unfollow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return { activity, error: "Unfollow: object must be '@user@domain' string" };
    }

    const actor = await User.findOne({ actorId: activity.actorId });
    if (!actor) return { activity, error: "Unfollow: actor not found" };

    const member = await toMember(activity.object);
    if (!member || !member.id) return { activity, error: "Unfollow: could not resolve member" };

    let targetId = activity.target;
    if (!targetId) {
      const followingCircle = await Circle.findOne({ "owner.id": actor.id, subtype: "Following" });
      targetId = followingCircle?.id;
    }
    if (!targetId) return { activity, error: "Unfollow: no target circle found" };

    const res = await Circle.updateOne(
      { id: targetId, "members.id": member.id },
      { $pull: { members: { id: member.id } }, $inc: { memberCount: -1 } }
    );

    const removed = !!(res && res.modifiedCount > 0);
    return { activity, result: { status: removed ? "unfollowed" : "not_following", target: targetId } };
  } catch (err) {
    return { activity, error: `Unfollow: ${err.message}` };
  }
}
