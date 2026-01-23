// Helper function to create notifications
// Notifications alert users about actions that involve them

import { Notification, User } from "#schema";
import { nanoid } from "nanoid";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Create a notification
 * @param {Object} params
 * @param {string} params.type - Notification type (reply, react, mention, new_post, invite, join_request, join_approved)
 * @param {string} params.recipientId - User ID who receives the notification
 * @param {string} params.actorId - User ID who triggered the notification
 * @param {string} [params.objectId] - ID of the object involved (post, group, etc.)
 * @param {string} [params.objectType] - Type of the object (Post, Group, etc.)
 * @param {string} [params.activityId] - ID of the triggering activity
 * @param {string} [params.activityType] - Type of the triggering activity
 * @param {string} [params.summary] - Custom summary text (auto-generated if not provided)
 * @param {string} [params.href] - Custom href (auto-generated if not provided)
 * @param {string} [params.groupKey] - Key for aggregating notifications
 * @returns {Promise<Object>} Created notification or null if preferences prevent creation
 */
export default async function createNotification(params) {
  try {
    const {
      type,
      recipientId,
      actorId,
      objectId,
      objectType,
      activityId,
      activityType,
      summary: customSummary,
      href: customHref,
      groupKey,
    } = params;

    // Don't create notification if actor is the recipient (no self-notifications)
    if (actorId === recipientId) {
      return null;
    }

    // Fetch actor info for display
    const actor = await User.findOne({ id: actorId }).select("id profile").lean();
    const actorName = actor?.profile?.name || actorId;
    const actorIcon = actor?.profile?.icon;

    // Generate summary if not provided
    const summary = customSummary || generateSummary(type, actorName, objectType);

    // Generate href if not provided
    const href = customHref || generateHref(type, objectId, objectType);

    // Check if similar notification already exists (for deduplication)
    if (groupKey) {
      const existing = await Notification.findOne({
        recipientId,
        groupKey,
        read: false,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Within last 24 hours
      });

      if (existing) {
        // Don't create duplicate notification
        return existing;
      }
    }

    // Create notification ID
    const { domain } = getServerSettings();
    const notifId = `notif:${nanoid(12)}@${domain}`;

    // Create notification
    const notification = await Notification.create({
      id: notifId,
      type,
      recipientId,
      actorId,
      actorName,
      actorIcon,
      objectId,
      objectType,
      activityId,
      activityType,
      summary,
      href,
      groupKey,
      read: false,
      dismissed: false,
      createdAt: new Date(),
    });

    console.log(`Notification created: ${notifId} (${type}) for ${recipientId}`);

    return notification;
  } catch (err) {
    console.error("Failed to create notification:", err.message);
    // Non-fatal: don't block activity if notification creation fails
    return null;
  }
}

/**
 * Generate summary text for notification
 */
function generateSummary(type, actorName, objectType) {
  switch (type) {
    case "reply":
      return `${actorName} replied to your post`;
    case "react":
      return `${actorName} reacted to your post`;
    case "mention":
      return `${actorName} mentioned you in a post`;
    case "new_post":
      return `${actorName} created a new post`;
    case "invite":
      return `${actorName} invited you to a group`;
    case "join_request":
      return `${actorName} requested to join your group`;
    case "join_approved":
      return `Your request to join the group was approved`;
    default:
      return `${actorName} performed an action`;
  }
}

/**
 * Generate href for notification
 */
function generateHref(type, objectId, objectType) {
  const { domain, protocol } = getServerSettings();
  const baseUrl = `${protocol}://${domain}`;

  if (!objectId) {
    return baseUrl;
  }

  // Parse object ID to get URL path
  // Format: "type:id@domain"
  const match = objectId.match(/^([a-z]+):([^@]+)@/);
  if (match) {
    const [, objType, localId] = match;
    switch (objType) {
      case "post":
        return `${baseUrl}/posts/${localId}`;
      case "reply":
        return `${baseUrl}/posts/${localId}`;
      case "group":
        return `${baseUrl}/groups/${localId}`;
      case "page":
        return `${baseUrl}/pages/${localId}`;
      default:
        return `${baseUrl}/${objType}s/${localId}`;
    }
  }

  return baseUrl;
}
