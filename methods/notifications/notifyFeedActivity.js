// Fire feed / group "new posts" nudges when a Post is created.
//
// Two streams, both throttled + read-gated by createNotification's cooldownMs
// (at most one per 12h per user/key, and never a pile-up while an earlier one
// sits unread):
//   - Feed:  "Your feeds have new posts"  (key "feed", per user) — for public/
//            server posts (author's followers) and circle-addressed posts
//            (the circle's members). Group posts are carved out.
//   - Group: "There are new posts in '<name>'" (key group_posts:<id>, per group).
//
// Opt-in only, via prefs.notifications.new_post. Author never notified of their
// own post (createNotification's self-guard + the exclude below).

import { Circle, Group, User } from "#schema";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";
import createNotification from "./create.js";

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// Local users among `ids` who opted into new-post notifications, minus the author.
async function optedIn(ids, excludeId) {
  const list = [...new Set(ids)].filter((id) => id && id !== excludeId);
  if (!list.length) return [];
  const users = await User.find({
    id: { $in: list },
    "prefs.notifications.new_post": true,
  })
    .select("id")
    .lean();
  return users.map((u) => u.id);
}

export default async function notifyFeedActivity(post) {
  try {
    if (!post?.id || !post?.actorId) return;
    const authorId = post.actorId;
    const to = String(post.to || "").trim();
    const dl = getServerSettings().domain?.toLowerCase();

    const tokens = to.split(/\s+/).filter(Boolean);
    const groupIds = tokens.filter((t) => t.startsWith("group:"));
    const circleIds = tokens.filter((t) => t.startsWith("circle:"));
    const low = to.toLowerCase();
    const isPublicOrServer =
      !to ||
      low === "@public" ||
      low === "public" ||
      low === "@server" ||
      low === "server" ||
      low === `@${dl}`;

    // ── GROUP posts → one throttled notification per group ──────────────────
    if (groupIds.length) {
      const groups = await Group.find({ id: { $in: groupIds } })
        .select("id name members")
        .lean();
      for (const g of groups) {
        const recipients = await optedIn((g.members || []).map((m) => m.id), authorId);
        for (const recipientId of recipients) {
          await createNotification({
            type: "new_post",
            recipientId,
            actorId: authorId,
            objectId: g.id,
            objectType: "Group",
            summary: `There are new posts in "${g.name}"`,
            groupKey: `group_posts:${g.id}`,
            cooldownMs: COOLDOWN_MS,
          });
        }
      }
      return; // group posts belong to the group stream, not the feed nudge
    }

    // ── FEED posts (public / server / circle) → single per-user nudge ───────
    let recipientIds = [];
    if (isPublicOrServer) {
      // Followers = local users who have this author in one of their circles.
      const circles = await Circle.find({ "members.id": authorId })
        .select("actorId")
        .lean();
      recipientIds = circles.map((c) => c.actorId);
    } else if (circleIds.length) {
      // Circle-addressed → the circle's members (the audience).
      const circles = await Circle.find({ id: { $in: circleIds } })
        .select("members")
        .lean();
      const set = new Set();
      for (const c of circles) for (const m of c.members || []) if (m.id) set.add(m.id);
      recipientIds = [...set];
    } else {
      return; // private (single user) or unrecognized — no feed nudge
    }

    const recipients = await optedIn(recipientIds, authorId);
    for (const recipientId of recipients) {
      await createNotification({
        type: "new_post",
        recipientId,
        actorId: authorId,
        // No objectId → generic "your feeds have new posts"; opens the feed.
        summary: "Your feeds have new posts",
        groupKey: "feed",
        cooldownMs: COOLDOWN_MS,
      });
    }
  } catch (err) {
    console.error("notifyFeedActivity failed:", err?.message);
  }
}
