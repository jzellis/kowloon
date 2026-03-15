// routes/admin/system.js — Server system info
import express from "express";
import os from "os";
import { statfs } from "fs/promises";
import mongoose from "mongoose";
import route from "../utils/route.js";
import { Activity, Circle, Flag, Group, Invite, Page, Post, Reply, React, User } from "#schema";

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

export default router;
