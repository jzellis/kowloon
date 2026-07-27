// Notify LOCAL users tagged (@username@domain) in a post or reply. Remote handles
// are linked (see ./linkify.js) but never notified. Opt-out via
// prefs.notifications.mention. Fully non-fatal — never blocks the write.

import User from "#schema/User.js";
import createNotification from "#methods/notifications/create.js";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import { extractMentions } from "./linkify.js";

export default async function notifyMentions({
  content,
  actorId,
  actorName,
  objectId,
  objectType,
}) {
  try {
    if (!content || !objectId) return;
    const { domain } = getServerSettings();
    const local = extractMentions(content).filter((m) => m.domain === domain);
    for (const { handle } of local) {
      if (handle === actorId) continue; // self-mention (createNotification also guards)
      const user = await User.findOne({ id: handle, active: { $ne: false } })
        .select("id prefs")
        .lean();
      if (!user) continue;
      if (user.prefs?.notifications?.mention === false) continue;
      await createNotification({
        type: "mention",
        recipientId: user.id,
        actorId,
        objectId,
        objectType,
        summary: `${actorName || actorId} mentioned you`,
        // One notification per (object, recipient) so editing/re-saving the
        // post never piles up duplicates.
        groupKey: `mention:${objectId}:${user.id}`,
      });
    }
  } catch (err) {
    console.error("Failed to create mention notifications:", err.message);
  }
}
