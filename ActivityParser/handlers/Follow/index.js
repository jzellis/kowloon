// /ActivityParser/handlers/Follow/index.js
import { Circle, User } from "#schema";
import toMember from "#methods/parse/toMember.js";

export default async function Follow(activity) {
  try {
    if (!activity?.actorId || typeof activity.actorId !== "string") {
      return { activity, error: "Follow: missing activity.actorId" };
    }
    if (!activity?.object || typeof activity.object !== "string") {
      return { activity, error: "Follow: object must be '@user@domain' string" };
    }

    const actor = await User.findOne({ actorId: activity.actorId });
    if (!actor) return { activity, error: "Follow: actor not found" };

    const member = await toMember(activity.object);
    if (!member || !member.id) return { activity, error: "Follow: could not resolve member" };

    let targetId = activity.target;
    if (!targetId) {
      const followingCircle = await Circle.findOne({ "owner.id": actor.id, subtype: "Following" });
      targetId = followingCircle?.id;
    }
    if (!targetId) return { activity, error: "Follow: no target circle found" };

    const res = await Circle.updateOne(
      { id: targetId, "members.id": { $ne: member.id } },
      { $push: { members: member }, $inc: { memberCount: 1 } }
    );

    const added = !!(res && (res.modifiedCount > 0 || res.upsertedCount > 0));
    return { activity, result: { status: added ? "followed" : "already_following", target: targetId } };
  } catch (err) {
    return { activity, error: `Follow: ${err.message}` };
  }
}
