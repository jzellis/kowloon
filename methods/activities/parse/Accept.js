import { User } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";
import getObjectById from "#methods/get/objectById.js";
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
  let user = await User.findOne({ id: activity.actorId });
  let target = await getObjectById(activity.target);

  if (
    user &&
    target &&
    target.pending.some((member) => member.id === activity.actorId) &&
    !target.members.some((member) => member.id === activity.actorId)
  ) {
    target.members.push({
      id: activity.actorId,
      serverId: `@${kowloonId(activity.actorId).server}`,
      name: user.profile.name,
      inbox: `https://${kowloonId(activity.actorId).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${kowloonId(activity.actorId).server}/users/${
        activity.target
      }/outbox`,
      icon: user.profile.icon,
      url: `https://${kowloonId(activity.actorId).server}/users/${
        activity.target
      }`,
    });
    target.pending = target.pending.filter(
      (member) => member.id !== activity.actorId
    );
    await target.save();
    activity.summary = `@${user.profile.name} joined ${target.name}`;

    // Check if accepting into a remote group/event
    const localDomain = getSetting("domain") || process.env.DOMAIN;
    const targetDomain = extractDomain(activity.target);
    if (targetDomain && localDomain && targetDomain !== localDomain.toLowerCase()) {
      activity.federate = true;
    }
  }
  return activity;
}
