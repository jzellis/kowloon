import { User } from "#schema";
import getObjectById from "#methods/get/objectById.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { getSetting } from "#methods/settings/cache.js";

// Extract domain from various ID formats
function extractDomain(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) {
    return id.slice(at + 1).toLowerCase();
  }
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export default async function (activity) {
  activity.to = activity.actorId;
  activity.canReply = activity.actorId;
  activity.canReact = activity.actorId;
  let user = await User.findOne({ id: activity.actorId });
  let target = await getObjectById(activity.target);

  if (
    user &&
    target &&
    target.pending.some((member) => member.id === activity.actorId)
  ) {
    target.pending = target.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await target.save();
    activity.summary = `@${user.profile.name} rejected an invite to join ${target.name}`;

    // Check if rejecting an invite from a remote group/event
    const localDomain = getSetting("domain") || process.env.DOMAIN;
    const targetDomain = extractDomain(activity.target);
    if (targetDomain && localDomain && targetDomain !== localDomain.toLowerCase()) {
      activity.federate = true;
    }
  }
  return activity;
}
