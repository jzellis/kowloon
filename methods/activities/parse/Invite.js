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
  let invitedUser = await User.findOne({ id: activity.object });

  if (
    user &&
    group &&
    !group.members.some((member) => member.id === activity.object) &&
    !group.pending.some((member) => member.id === activity.object)
  ) {
    group.pending.push({
      id: activity.object,
      serverId: `@${kowloonId(activity.object).server}`,
      name: invitedUser.profile.name,
      inbox: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }/inbox`,
      outbox: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }/outbox`,
      icon: user.profile.icon,
      url: `https://${kowloonId(activity.object).server}/users/${
        activity.target
      }`,
    });

    await group.save();
    activity.summary = `@${user.profile.name} invited ${invitedUser.profile.name} to join ${group.name}`;

    // Check if inviting to/from remote Group/Event, or inviting remote user
    const localDomain = getSetting("domain") || process.env.DOMAIN;
    const groupDomain = extractDomain(activity.target);
    const inviteeDomain = extractDomain(activity.object);

    if (
      (groupDomain && localDomain && groupDomain !== localDomain.toLowerCase()) ||
      (inviteeDomain && localDomain && inviteeDomain !== localDomain.toLowerCase())
    ) {
      activity.federate = true;
    }
  }
  return activity;
}
