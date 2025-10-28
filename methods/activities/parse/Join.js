import { Group, User } from "#schema";
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
  let user = await User.findOne({ id: activity.actorId });
  let group = await Group.findOne({ id: activity.target });

  if (user && group) {
    if (
      group.private === false &&
      !group.members.some((member) => member.id === activity.actorId)
    ) {
      group.members.push({
        id: user.id,
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
    } else {
      if (!group.pending.some((member) => member.id === activity.actorId))
        group.pending.push({
          id: user.id,
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
    }
    await group.save();
    activity.summary = `@${user.profile.name} joined ${group.name}`;

    // Check if joining a remote group
    const localDomain = getSetting("domain") || process.env.DOMAIN;
    const groupDomain = extractDomain(activity.target);
    if (groupDomain && localDomain && groupDomain !== localDomain.toLowerCase()) {
      activity.federate = true;
    }
  }
  return activity;
}
