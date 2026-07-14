import { Group, Circle, User } from "#schema";
import getObjectById from "#methods/core/getObjectById.js";
import getSettings from "#methods/settings/get.js";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import isServerMod from "#methods/auth/isServerMod.js";
import isGroupAdmin from "#methods/groups/isAdmin.js";
import toMember from "#methods/parse/toMember.js";
import createNotification from "#methods/notifications/create.js";
import getMultiFederationTargets from "../utils/getMultiFederationTargets.js";
import pullFromRemote from "#methods/federation/pullFromRemote.js";

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

    // Support array or single object — resolve all in parallel
    const objects = Array.isArray(activity.object) ? activity.object : [activity.object];
    const resolved = (await Promise.all(objects.map(resolveActorToMember))).filter(Boolean);

    if (resolved.length === 0) return { activity, error: "Add: no valid members resolved" };

    // Deduplicate against members already in the circle
    const existing = await Circle.findOne({ id: activity.target }).select("members.id").lean();
    const existingIds = new Set((existing?.members || []).map((m) => m.id));
    const toAdd = resolved.filter((m) => !existingIds.has(m.id));

    // Normalize activity.object for downstream code
    activity.object = resolved.length === 1 ? resolved[0] : resolved;

    let res = { modifiedCount: 0 };
    if (toAdd.length > 0) {
      res = await Circle.updateOne(
        { id: activity.target },
        {
          $push: { members: { $each: toAdd } },
          $inc: { memberCount: toAdd.length },
        }
      );
    }

    // Playlist-style icon inheritance: a user-created circle that still shows
    // the generic default icon adopts the first added member's icon (person or
    // server) — like a playlist taking its first track's cover. It stays the
    // generic icon until a member with an icon exists, and we never overwrite a
    // user-chosen icon or touch System circles.
    if (
      ownerType === "User" &&
      targetCircle.type !== "System" &&
      (res.modifiedCount || 0) > 0
    ) {
      const isDefaultIcon = (v) => !v || /\/images\/circle\.svg$/.test(v);
      if (isDefaultIcon(targetCircle.icon)) {
        const fresh = await Circle.findOne({ id: activity.target })
          .select("members icon")
          .lean();
        const firstWithIcon = (fresh?.members || []).find((m) => m.icon);
        if (isDefaultIcon(fresh?.icon) && firstWithIcon?.icon) {
          await Circle.updateOne(
            { id: activity.target },
            { $set: { icon: firstWithIcon.icon } }
          );
        }
      }
    }

    // If adding to a Group's members circle, update each user's Groups circle,
    // remove from pending, and notify — one member at a time.
    if (ownerType === "Group" && res.modifiedCount > 0) {
      const group = await Group.findOne({ id: ownerId }).lean();

      for (const member of toAdd) {
        // Add group to user's Groups circle
        if (group?.circles?.members === activity.target) {
          const addedUser = await User.findOne({ id: member.id }).select("circles").lean();
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
          const pendingRemoval = await Circle.updateOne(
            { id: group.circles.pending, "members.id": member.id },
            { $pull: { members: { id: member.id } }, $inc: { memberCount: -1 } }
          );

          if (pendingRemoval.modifiedCount > 0) {
            try {
              const recipient = await User.findOne({ id: member.id }).select("prefs").lean();
              const wantsNotification = recipient?.prefs?.notifications?.join_approved !== false;
              if (wantsNotification) {
                await createNotification({
                  type: "join_approved",
                  recipientId: member.id,
                  actorId: activity.actorId,
                  objectId: ownerId,
                  objectType: "Group",
                  activityId: activity.id,
                  activityType: "Add",
                  groupKey: `join_approved:${ownerId}:${member.id}`,
                });
              }
            } catch (err) {
              console.error("Failed to create join_approved notification:", err.message);
            }
          }
        }
      }
    }

    // Federate to any remote members that were actually added
    const localDomain = settings?.domain || process.env.DOMAIN || "";
    const remoteMembers = toAdd.filter((m) => {
      const domain =
        m?.server?.replace(/^@/, "") ||
        (m?.id?.match(/^@[^@]+@(.+)$/) || [])[1] ||
        "";
      return m?.id && domain && domain !== localDomain;
    });

    if (remoteMembers.length > 0) {
      activity.to =
        remoteMembers.length === 1
          ? remoteMembers[0].id
          : remoteMembers.map((m) => m.id);
    }

    // Immediately pull recent content for newly added remote entities in
    // user-owned circles. Fire-and-forget — the worker handles retries.
    if (ownerType === "User" && remoteMembers.length > 0) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for (const member of remoteMembers) {
        const isServer = /^@[^@]+$/.test(member.id);
        const remoteDomain = isServer
          ? member.id.slice(1)
          : (member.id.match(/^@[^@]+@(.+)$/) || [])[1];
        if (!remoteDomain) continue;
        pullFromRemote({
          remoteDomain,
          from: [member.id],
          to: [activity.actorId],
          since,
          limit: 100,
        }).catch(() => {});
      }
    }

    // For Group adds (join_approved being the common case), deliver the Add
    // to each remote member's home server so it can run the handler locally
    // and create the notification there. Without this, the approval is only
    // recorded on the group's host and the approved user sees nothing when
    // they log into their own server. Personal/server-admin circles keep the
    // legacy resolveAudience path via `federate: true`.
    let federation;
    if (ownerType === "Group" && remoteMembers.length > 0) {
      federation = getMultiFederationTargets(
        ...remoteMembers.map((m) => m.id),
      );
    }

    return {
      activity,
      circleId: activity.target,
      added: (res.modifiedCount || 0) > 0,
      addedCount: toAdd.length,
      federate: remoteMembers.length > 0,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
