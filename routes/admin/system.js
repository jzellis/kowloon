// routes/admin/system.js — Server system info
import express from "express";
import os from "os";
import { statfs } from "fs/promises";
import mongoose from "mongoose";
import route from "../utils/route.js";
import { Activity, Circle, Flag, Group, Invite, Page, Post, Reply, React, User } from "#schema";
import getSettings from "#methods/settings/get.js";

const router = express.Router({ mergeParams: true });

router.get(
  "/",
  route(
    async ({ set }) => {
      const db = mongoose.connection.db;

      // DB stats
      const dbStats = await db.stats({ scale: 1024 }); // values in KB

      // Collection counts (in parallel)
      const [
        userCount, postCount, groupCount, circleCount,
        pageCount, replyCount, reactCount, activityCount,
        flagCount, inviteCount,
      ] = await Promise.all([
        User.countDocuments({ deletedAt: null }),
        Post.countDocuments({ deletedAt: null }),
        Group.countDocuments({ deletedAt: null }),
        Circle.countDocuments({}),
        Page.countDocuments({ deletedAt: null }),
        Reply.countDocuments({}),
        React.countDocuments({}),
        Activity.countDocuments({}),
        Flag.countDocuments({ status: "open" }),
        Invite.countDocuments({ active: true, deletedAt: null }),
      ]);

      // Disk stats for the process working directory
      let disk = null;
      try {
        const fs = await statfs(process.cwd());
        const total = fs.bsize * fs.blocks;
        const free = fs.bsize * fs.bfree;
        disk = {
          totalKb: Math.round(total / 1024),
          freeKb: Math.round(free / 1024),
          usedKb: Math.round((total - free) / 1024),
          usedPct: Math.round(((total - free) / total) * 100),
        };
      } catch {
        // statfs not available on all platforms
      }

      set("database", {
        name: dbStats.db,
        dataKb: Math.round(dbStats.dataSize),
        storageKb: Math.round(dbStats.storageSize),
        indexKb: Math.round(dbStats.indexSize),
        totalKb: Math.round(dbStats.dataSize + dbStats.indexSize),
        collections: dbStats.collections,
        objects: dbStats.objects,
      });

      set("counts", {
        users: userCount,
        posts: postCount,
        groups: groupCount,
        circles: circleCount,
        pages: pageCount,
        replies: replyCount,
        reacts: reactCount,
        activities: activityCount,
        openFlags: flagCount,
        activeInvites: inviteCount,
      });

      set("server", {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: {
          total: Math.round(os.totalmem() / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
          processRss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          processHeap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      });

      if (disk) set("disk", disk);
    },
    { allowUnauth: false }
  )
);

// ── Admin / Mod circle member management ──────────────────────────────────
// These circles are owned by the server actor, not a user, so we manage them
// directly rather than going through the ActivityPub Add/Remove pipeline.

async function getRoleCircle(role) {
  const settings = await getSettings();
  const id = role === "admin" ? settings.adminCircle : settings.modCircle;
  if (!id) return null;
  return Circle.findOne({ id });
}

function toMemberDoc(user, domain) {
  return {
    id: user.id,
    name: user.profile?.name ?? user.username,
    icon: user.profile?.icon ?? null,
    inbox: user.inbox ?? null,
    outbox: user.outbox ?? null,
    url: user.url ?? null,
    server: user.server ?? domain,
  };
}

for (const role of ["admins", "mods"]) {
  const circleRole = role === "admins" ? "admin" : "mod";

  router.get(`/${role}`, async (req, res, next) => {
    try {
      const circle = await getRoleCircle(circleRole);
      if (!circle) return res.status(500).json({ error: `${role} circle not configured` });
      res.json({ members: circle.members ?? [] });
    } catch (err) { next(err); }
  });

  router.post(`/${role}`, async (req, res, next) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });

      const circle = await getRoleCircle(circleRole);
      if (!circle) return res.status(500).json({ error: `${role} circle not configured` });

      if (circle.members.some((m) => m.id === userId)) {
        return res.json({ ok: true, alreadyMember: true });
      }

      const user = await User.findOne({ id: userId, active: true, deletedAt: null }).lean();
      if (!user) return res.status(404).json({ error: "User not found" });

      const settings = await getSettings();
      circle.members.push(toMemberDoc(user, settings.domain));
      circle.memberCount = circle.members.length;
      await circle.save();

      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.delete(`/${role}/:userId`, async (req, res, next) => {
    try {
      const userId = decodeURIComponent(req.params.userId);
      const circle = await getRoleCircle(circleRole);
      if (!circle) return res.status(500).json({ error: `${role} circle not configured` });

      circle.members = circle.members.filter((m) => m.id !== userId);
      circle.memberCount = circle.members.length;
      await circle.save();

      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}

router.get("/backup", async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const colInfos = await db.listCollections().toArray();
    const collections = {};
    for (const col of colInfos) {
      collections[col.name] = await db.collection(col.name).find({}).toArray();
    }
    const exportedAt = new Date().toISOString();
    const dateStr = exportedAt.split("T")[0];
    res
      .setHeader("Content-Disposition", `attachment; filename="kowloon-backup-${dateStr}.json"`)
      .setHeader("Content-Type", "application/json; charset=utf-8")
      .json({ exportedAt, collections });
  } catch (err) {
    next(err);
  }
});

export default router;
