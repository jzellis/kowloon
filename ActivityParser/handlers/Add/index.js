import { Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import getSettings from "#methods/settings/get.js";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import isServerMod from "#methods/auth/isServerMod.js";
import isGroupAdmin from "#methods/groups/isAdmin.js";
import toMember from "#methods/parse/toMember.js";
import createNotification from "#methods/notifications/create.js";

export default async function Add(activity) {
  try {
    let settings = await getSettings();

    // Support two patterns:
    // 1. Legacy: target = circle ID (explicit circle)
    // 2. New: to = group ID, target = optional circle ID (defaults to members)
    let targetCircle;
    let ownerId;
    let ownerType;

    if (activity.to && /^group:[^@]+@[^@]+$/.test(activity.to)) {
      // New pattern: to = groupId, target = optional specific circle
      const group = await Group.findOne({ id: activity.to }).select("circles").lean();
      if (!group) return { activity, error: "Group not found" };

      ownerId = activity.to;
      ownerType = "Group";

      // If target is specified, verify it belongs to this group
      if (activity.target) {
        if (!activity.target.startsWith("circle:"))
          return { activity, error: "Invalid target Circle" };

        // Verify the target circle belongs to this group
        const circleIds = Object.values(group.circles || {});
        if (!circleIds.includes(activity.target)) {
          return { activity, error: "Target circle does not belong to this group" };
        }

        targetCircle = await Circle.findOne({ id: activity.target });
        if (!targetCircle) return { activity, error: "Target circle not found" };
      } else {
        // Default to members circle
        if (!group.circles?.members) {
          return { activity, error: "Group members circle not found" };
        }
        targetCircle = await Circle.findOne({ id: group.circles.members });
        if (!targetCircle) return { activity, error: "Group members circle not found" };
        activity.target = group.circles.members; // Set for downstream code
      }
    } else {
      // Legacy pattern: target = circle ID
      if (!activity.target)
        return { activity, error: "No target Circle specified" };
      if (!activity.target.startsWith("circle:"))
        return { activity, error: "Invalid target Circle" };

      targetCircle = await Circle.findOne({ id: activity.target });
      if (!targetCircle) return { activity, error: "Target circle not found" };

      ownerId = targetCircle?.actorId || "";
      ownerType = /^group:[^@]+@[^@]+$/.test(ownerId)
        ? "Group"
        : /^@[^@]+@[^@]+$/.test(ownerId)
        ? "User"
        : /^@[^@]+$/.test(ownerId)
        ? "Server"
        : "Unknown";
    }

    switch (ownerType) {
      case "User":
        if (activity.actorId !== targetCircle.actorId)
          return { activity, error: "You are not the owner of this circle" };
        break;
      case "Server":
        if (targetCircle.actorId != settings.actorId)
          return { activity, error: "Cannot update remote server Circles" };
        if (
          activity.target === settings.adminCircle &&
          !(await isServerAdmin(activity.actorId))
        )
          return { activity, error: "You are not a server admin" };
        if (
          activity.target === settings.modCircle &&
          !(await isServerMod(activity.actorId))
        )
          return { activity, error: "You are not a server moderator" };
        break;
      case "Group":
        if (!(await isGroupAdmin(activity.actorId, targetCircle.actorId)))
          return { activity, error: "You are not a group admin" };
        break;
    }

    // Normalize the "user to add" so we accept:
    //  1) "@user@domain" (actorId string)
    //  2) { actorId: "@user@domain" }
    //  3) DB id / full object (legacy paths)
    async function resolveActorToMember(ref) {
      // String case
      if (typeof ref === "string") {
        const s = ref.trim();

        // Bare server entry: "@domain" (one @ at start, no second @)
        // Store as a lightweight member with just the server id — no inbox/outbox
        if (/^@[^@]+$/.test(s)) {
          const domain = s.slice(1);
          return {
            id: s,
            name: domain,
            icon: "",
            inbox: "",
            outbox: "",
            url: `https://${domain}`,
            server: s,
          };
        }

        if (/^@[^@]+@[^@]+$/.test(s)) {
          // Try local User first — skip stale records with no useful data
          const u = await User.findOne({ id: s }).lean();
          if (u && (u.inbox || u.name || u.profile?.name)) return toMember(u);

          // Remote actor: fetch via getObjectById (tries /resolve then /users/:username)
          try {
            const result = await getObjectById(s, { hydrateRemoteIntoDB: false });
            if (result?.object) {
              const a = result.object;
              const [, username, domain] = s.match(/^@([^@]+)@(.+)$/) || [];
              return {
                id: s,
                name: a.name || a.profile?.name || a.preferredUsername || username || "",
                icon: a.icon?.url || a.icon || a.profile?.icon || "",
                inbox: a.inbox || (domain && username ? `https://${domain}/users/${username}/inbox` : ""),
                outbox: a.outbox || (domain && username ? `https://${domain}/users/${username}/outbox` : ""),
                url: a.url || (domain && username ? `https://${domain}/users/${username}` : ""),
                server: `@${domain || ""}`,
              };
            }
          } catch {
            // Fall through to minimal fallback
          }

          // Minimal fallback: construct from known ID format
          const [, username, domain] = s.match(/^@([^@]+)@(.+)$/) || [];
          if (username && domain) {
            return {
              id: s,
              name: username,
              icon: "",
              inbox: `https://${domain}/users/${username}/inbox`,
              outbox: `https://${domain}/users/${username}/outbox`,
              url: `https://${domain}/users/${username}`,
              server: `@${domain}`,
            };
          }
        }
        // not an actorId string → treat as DB id / other resolvable id
        const o = await getObjectById(s);
        return toMember(o?.object || o);
      }

      // Object case
      if (ref && typeof ref === "object") {
        if (
          typeof ref.actorId === "string" &&
          /^@[^@]+@[^@]+$/.test(ref.actorId)
        ) {
          return resolveActorToMember(ref.actorId);
        }
        // If it already looks like a User/Actor object, let toMember handle it
        return toMember(ref);
      }

      return null;
    }

    const member = await resolveActorToMember(activity.object);

    activity.object = member; // normalize the activity payload to the cached actor shape

    let res = await Circle.updateOne(
      { id: activity.target, "members.id": { $ne: activity.object.id } },
      {
        $push: { members: activity.object },
        $inc: { memberCount: 1 },
      }
    );

    // If adding to a Group's members circle, update user's Groups circle, remove from pending, and notify
    if (ownerType === "Group" && res.modifiedCount > 0) {
      const group = await Group.findOne({ id: ownerId }).lean();

      // Add group to user's Groups circle
      if (group?.circles?.members === activity.target) {
        const addedUser = await User.findOne({ id: activity.object.id }).select("circles").lean();
        if (addedUser?.circles?.groups) {
          const groupMember = {
            id: group.id,
            name: group.name || "",
            icon: group.icon || "",
            url: group.url || "",
            inbox: group.inbox || "",
            outbox: group.outbox || "",
            server: group.server || "",
          };
          await Circle.updateOne(
            { id: addedUser.circles.groups, "members.id": { $ne: group.id } },
            { $push: { members: groupMember }, $inc: { memberCount: 1 } }
          );
        }
      }

      if (group?.circles?.members === activity.target && group?.circles?.pending) {
        // Remove from pending circle if they were there
        const pendingRemoval = await Circle.updateOne(
          { id: group.circles.pending, "members.id": activity.object.id },
          {
            $pull: { members: { id: activity.object.id } },
            $inc: { memberCount: -1 },
          }
        );

        // If user was in pending (i.e., this was an approval), notify them
        if (pendingRemoval.modifiedCount > 0) {
          try {
            // Check if user wants join_approved notifications (default true)
            const recipient = await User.findOne({ id: activity.object.id }).select("prefs").lean();
            const wantsNotification = recipient?.prefs?.notifications?.join_approved !== false;

            if (wantsNotification) {
              await createNotification({
                type: "join_approved",
                recipientId: activity.object.id,
                actorId: activity.actorId, // The admin who approved
                objectId: ownerId,
                objectType: "Group",
                activityId: activity.id,
                activityType: "Add",
                groupKey: `join_approved:${ownerId}:${activity.object.id}`,
              });
            }
          } catch (err) {
            console.error("Failed to create join_approved notification:", err.message);
            // Non-fatal
          }
        }
      }
    }

    // Federate when a remote actor was added — set activity.to so resolveAudience
    // can find their inbox via getObjectById.
    const localDomain = settings?.domain || process.env.DOMAIN || "";
    // Derive domain from server field, or fall back to parsing the member ID
    const memberDomain =
      member?.server?.replace(/^@/, "") ||
      (member?.id?.match(/^@[^@]+@(.+)$/) || [])[1] ||
      "";
    const isRemoteMember =
      member?.id && memberDomain && memberDomain !== localDomain;

    if (isRemoteMember) {
      activity.to = member.id; // @user@remotedomain — resolveAudience will fetch inbox
    }

    return {
      activity,
      circleId: activity.target,
      added: (res.modifiedCount || 0) > 0,
      federate: isRemoteMember,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
