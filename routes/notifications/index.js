// Notification API routes
// Provides endpoints for retrieving and managing user notifications

import express from "express";
import { Notification } from "#schema";

const router = express.Router({ mergeParams: true });

/**
 * GET /notifications
 * List notifications with filtering and pagination
 *
 * Query params:
 * - types: Comma-separated notification types to filter (reply,react,mention,etc)
 * - unread: "true" to only show unread notifications
 * - limit: Number of notifications to return (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 *
 * Examples:
 * - /notifications?types=reply,react - Only replies and reacts
 * - /notifications?unread=true - Only unread
 * - /notifications?types=reply&unread=true - Only unread replies
 */
router.get("/", async (req, res) => {
  try {
    // Authentication: user must be logged in
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Parse query parameters
    const {
      types,
      unread,
      limit = 20,
      offset = 0,
    } = req.query;

    // Build query
    const query = {
      recipientId: user.id,
      dismissed: false, // Don't show dismissed notifications
    };

    // Filter by notification types (reply, react, mention, etc.)
    if (types) {
      const typeArray = types.split(",").map(t => t.trim());
      const validTypes = [
        "reply",
        "react",
        "mention",
        "new_post",
        "invite",
        "join_request",
        "join_approved",
      ];

      const filteredTypes = typeArray.filter(t => validTypes.includes(t));
      if (filteredTypes.length > 0) {
        query.type = { $in: filteredTypes };
      }
    }

    // Filter by read status
    if (unread === "true") {
      query.read = false;
    }

    // Validate pagination params
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const offsetNum = Math.max(0, parseInt(offset, 10) || 0);

    // Fetch notifications
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(offsetNum)
        .lean(),
      Notification.countDocuments(query),
    ]);

    // Return response
    return res.json({
      notifications,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
      filters: {
        types: types ? types.split(",").map(t => t.trim()) : null,
        unread: unread === "true",
      },
    });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * GET /notifications/unread/count
 * Get count of unread notifications
 *
 * Optionally filter by types:
 * - /notifications/unread/count?types=reply,react
 */
router.get("/unread/count", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { types } = req.query;

    const query = {
      recipientId: user.id,
      read: false,
      dismissed: false,
    };

    // Filter by types if provided
    if (types) {
      const typeArray = types.split(",").map(t => t.trim());
      const validTypes = [
        "reply",
        "react",
        "mention",
        "new_post",
        "invite",
        "join_request",
        "join_approved",
      ];

      const filteredTypes = typeArray.filter(t => validTypes.includes(t));
      if (filteredTypes.length > 0) {
        query.type = { $in: filteredTypes };
      }
    }

    const count = await Notification.countDocuments(query);

    return res.json({
      count,
      filters: {
        types: types ? types.split(",").map(t => t.trim()) : null,
      },
    });
  } catch (err) {
    console.error("Failed to fetch unread count:", err);
    return res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

/**
 * POST /notifications/:id/read
 * Mark a notification as read
 */
router.post("/:id/read", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { id, recipientId: user.id },
      { $set: { read: true } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ notification });
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    return res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read
 *
 * Optionally filter by types:
 * - POST /notifications/read-all?types=reply,react
 */
router.post("/read-all", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { types } = req.query;

    const query = {
      recipientId: user.id,
      read: false,
    };

    // Filter by types if provided
    if (types) {
      const typeArray = types.split(",").map(t => t.trim());
      const validTypes = [
        "reply",
        "react",
        "mention",
        "new_post",
        "invite",
        "join_request",
        "join_approved",
      ];

      const filteredTypes = typeArray.filter(t => validTypes.includes(t));
      if (filteredTypes.length > 0) {
        query.type = { $in: filteredTypes };
      }
    }

    const result = await Notification.updateMany(
      query,
      { $set: { read: true } }
    );

    return res.json({
      count: result.modifiedCount,
      filters: {
        types: types ? types.split(",").map(t => t.trim()) : null,
      },
    });
  } catch (err) {
    console.error("Failed to mark all as read:", err);
    return res.status(500).json({ error: "Failed to mark all as read" });
  }
});

/**
 * POST /notifications/:id/dismiss
 * Dismiss a notification (remove from list)
 */
router.post("/:id/dismiss", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { id, recipientId: user.id },
      { $set: { dismissed: true } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to dismiss notification:", err);
    return res.status(500).json({ error: "Failed to dismiss notification" });
  }
});

/**
 * DELETE /notifications/:id
 * Permanently delete a notification
 */
router.delete("/:id", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const result = await Notification.deleteOne({
      id,
      recipientId: user.id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete notification:", err);
    return res.status(500).json({ error: "Failed to delete notification" });
  }
});

/**
 * GET /notifications/types
 * Get available notification types and their counts
 * Useful for building filter UI
 */
router.get("/types", async (req, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { unread } = req.query;

    const query = {
      recipientId: user.id,
      dismissed: false,
    };

    if (unread === "true") {
      query.read = false;
    }

    // Aggregate counts by type
    const counts = await Notification.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const typeCounts = counts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    return res.json({
      types: typeCounts,
      filters: {
        unread: unread === "true",
      },
    });
  } catch (err) {
    console.error("Failed to fetch type counts:", err);
    return res.status(500).json({ error: "Failed to fetch type counts" });
  }
});

export default router;
