// routes/notifications/index.js
// Convenience redirect: /notifications/* -> /users/:id/notifications/*
// Resolves the authenticated user's ID so clients don't need to know it.

import express from "express";
import route from "../utils/route.js";
import { Notification } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

function requireAuth(user, setStatus, set) {
  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return false;
  }
  return true;
}

// GET /notifications
router.get(
  "/",
  route(async ({ req, query, user, set, setStatus }) => {
    if (!requireAuth(user, setStatus, set)) return;

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip = (page - 1) * limit;

    const filter = { recipientId: user.id, dismissed: false };
    if (query.types) {
      filter.type = { $in: query.types.split(",").map((t) => t.trim()) };
    }
    if (query.unread === "true") {
      filter.read = false;
    }

    const [docs, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${domain}/notifications`;

    const collection = activityStreamsCollection({
      id: `${base}?page=${page}`,
      orderedItems: docs,
      totalItems: total,
      page,
      itemsPerPage: limit,
      baseUrl: base,
    });

    for (const [key, value] of Object.entries(collection)) {
      set(key, value);
    }
  })
);

// GET /notifications/unread/count
router.get(
  "/unread/count",
  route(async ({ query, user, set, setStatus }) => {
    if (!requireAuth(user, setStatus, set)) return;

    const filter = { recipientId: user.id, read: false, dismissed: false };
    if (query.types) {
      filter.type = { $in: query.types.split(",").map((t) => t.trim()) };
    }

    const count = await Notification.countDocuments(filter);
    set("count", count);
  })
);

// POST /notifications/:notifId/read
router.post(
  "/:notifId/read",
  route(
    async ({ params, user, set, setStatus }) => {
      if (!requireAuth(user, setStatus, set)) return;

      const notification = await Notification.findOneAndUpdate(
        { id: params.notifId, recipientId: user.id },
        { $set: { read: true } },
        { new: true }
      ).lean();

      if (!notification) {
        setStatus(404);
        set("error", "Notification not found");
        return;
      }

      set("notification", notification);
    },
    { allowUnauth: false }
  )
);

// POST /notifications/:notifId/unread
router.post(
  "/:notifId/unread",
  route(
    async ({ params, user, set, setStatus }) => {
      if (!requireAuth(user, setStatus, set)) return;

      const notification = await Notification.findOneAndUpdate(
        { id: params.notifId, recipientId: user.id },
        { $set: { read: false } },
        { new: true }
      ).lean();

      if (!notification) {
        setStatus(404);
        set("error", "Notification not found");
        return;
      }

      set("notification", notification);
    },
    { allowUnauth: false }
  )
);

// POST /notifications/read-all
router.post(
  "/read-all",
  route(
    async ({ query, user, set, setStatus }) => {
      if (!requireAuth(user, setStatus, set)) return;

      const filter = { recipientId: user.id, read: false };
      if (query.types) {
        filter.type = { $in: query.types.split(",").map((t) => t.trim()) };
      }

      const result = await Notification.updateMany(filter, {
        $set: { read: true },
      });

      set("count", result.modifiedCount);
    },
    { allowUnauth: false }
  )
);

// POST /notifications/:notifId/dismiss
router.post(
  "/:notifId/dismiss",
  route(
    async ({ params, user, set, setStatus }) => {
      if (!requireAuth(user, setStatus, set)) return;

      const notification = await Notification.findOneAndUpdate(
        { id: params.notifId, recipientId: user.id },
        { $set: { dismissed: true } },
        { new: true }
      ).lean();

      if (!notification) {
        setStatus(404);
        set("error", "Notification not found");
        return;
      }

      set("ok", true);
    },
    { allowUnauth: false }
  )
);

export default router;
