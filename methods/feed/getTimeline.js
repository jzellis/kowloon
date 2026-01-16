// /methods/feed/getTimeline.js
// Unified timeline assembly: combines Feed, FeedItems, and remote pulls

import { Feed, FeedItems, Circle, Group, Event } from "#schema";
import logger from "#methods/utils/logger.js";
import fetch from "node-fetch";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

/**
 * Extract domain from actor ID or URL
 */
function extractDomain(str) {
  if (!str) return null;
  try {
    const url = new URL(str);
    return url.hostname;
  } catch {
    const parts = str.split('@').filter(Boolean);
    return parts[parts.length - 1];
  }
}

/**
 * Assemble a user's timeline from multiple sources
 *
 * @param {Object} options
 * @param {string} options.viewerId - The user requesting the timeline
 * @param {string} [options.circle] - Circle ID to show posts from members of this circle
 * @param {string} [options.author] - Author ID to show posts by this specific user
 * @param {string} [options.group] - Group ID to show posts addressed to this group
 * @param {string} [options.event] - Event ID to show posts addressed to this event
 * @param {string} [options.server] - Server domain to show public posts from
 * @param {string|Date} [options.since] - Only items after this timestamp
 * @param {number} [options.limit=50] - Max items to return
 * @returns {Promise<Object>} { items, nextCursor }
 */
export default async function getTimeline({
  viewerId,
  circle,
  author,
  group,
  event,
  server,
  since,
  limit = 50,
} = {}) {
  if (!viewerId) {
    throw new Error("getTimeline requires viewerId");
  }

  logger.info("getTimeline: Request", {
    viewerId,
    circle,
    author,
    group,
    event,
    server,
    since,
    limit,
  });

  const { domain: ourDomain } = getServerSettings();
  const allItems = [];

  // 1. CIRCLE TIMELINE - Posts by members of a specific Circle
  if (circle) {
    const items = await getCircleTimeline({ viewerId, circle, since, limit });
    allItems.push(...items);
  }

  // 2. AUTHOR TIMELINE - Posts by a specific user
  else if (author) {
    const items = await getAuthorTimeline({ viewerId, author, since, limit, ourDomain });
    allItems.push(...items);
  }

  // 3. GROUP TIMELINE - Posts addressed to a specific Group
  else if (group) {
    const items = await getGroupTimeline({ viewerId, group, since, limit, ourDomain });
    allItems.push(...items);
  }

  // 4. EVENT TIMELINE - Posts addressed to a specific Event
  else if (event) {
    const items = await getEventTimeline({ viewerId, event, since, limit, ourDomain });
    allItems.push(...items);
  }

  // 5. SERVER TIMELINE - Public posts from a server
  else if (server) {
    const items = await getServerTimeline({ viewerId, server, since, limit, ourDomain });
    allItems.push(...items);
  }

  // 6. DEFAULT - User's combined feed from all sources
  else {
    const items = await getDefaultTimeline({ viewerId, since, limit });
    allItems.push(...items);
  }

  // Deduplicate by ID, sort by publishedAt, and limit
  const itemsMap = new Map();
  for (const item of allItems) {
    if (!itemsMap.has(item.id)) {
      itemsMap.set(item.id, item);
    }
  }

  const sortedItems = Array.from(itemsMap.values())
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);

  logger.info("getTimeline: Assembled", {
    viewerId,
    totalItems: allItems.length,
    deduped: sortedItems.length,
  });

  return {
    items: sortedItems,
    nextCursor: sortedItems.length > 0
      ? sortedItems[sortedItems.length - 1].publishedAt
      : null,
  };
}

// ============================================================================
// Timeline Type Implementations
// ============================================================================

/**
 * Circle Timeline: Posts by members of a specific Circle
 */
async function getCircleTimeline({ viewerId, circle, since, limit }) {
  // Get Circle members
  const circleDoc = await Circle.findOne({ id: circle }).select("members").lean();
  if (!circleDoc?.members) return [];

  const memberIds = circleDoc.members.map(m => m.id).filter(Boolean);
  if (memberIds.length === 0) return [];

  // Get local items from Feed (includes Circle-based audience posts)
  const feedQuery = {
    actorId: viewerId,
    activityActorId: { $in: memberIds },
  };
  if (since) feedQuery.createdAt = { $gte: new Date(since) };

  const feedItems = await Feed.find(feedQuery)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Hydrate with FeedItems data
  const items = await hydrateFeedItems(feedItems.map(f => f.objectId));

  // TODO: Pull remote items for remote members in this Circle
  // const remoteMembers = memberIds.filter(id => extractDomain(id) !== ourDomain);
  // const remoteItems = await pullFromRemoteServers(remoteMembers, since, limit);

  return items;
}

/**
 * Author Timeline: Posts by a specific user
 */
async function getAuthorTimeline({ viewerId, author, since, limit, ourDomain }) {
  const authorDomain = extractDomain(author);
  const isLocal = authorDomain === ourDomain;

  if (isLocal) {
    // Query FeedItems for local author
    const query = {
      actorId: author,
      $or: [
        { to: "public" },
        { to: "server" },
        { group: { $exists: true, $ne: null } }, // Group posts (check membership separately)
        { event: { $exists: true, $ne: null } }, // Event posts (check membership separately)
      ],
    };
    if (since) query.publishedAt = { $gte: new Date(since) };

    const items = await FeedItems.find(query)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();

    // Filter out Group/Event posts if viewer isn't a member
    return await filterByMembership(items, viewerId);
  } else {
    // Pull from remote server
    return await pullFromRemote({
      domain: authorDomain,
      authors: [author],
      since,
      limit,
    });
  }
}

/**
 * Group Timeline: Posts addressed to a specific Group
 */
async function getGroupTimeline({ viewerId, group, since, limit, ourDomain }) {
  const groupDomain = extractDomain(group);
  const isLocal = groupDomain === ourDomain;

  if (isLocal) {
    // Check if viewer has access to this group
    const groupDoc = await Group.findOne({ id: group }).select("members rsvpPolicy").lean();
    if (!groupDoc) return [];

    const isPublic = groupDoc.rsvpPolicy === "open";
    let isMember = false;

    if (!isPublic && groupDoc.members) {
      const membersCircle = await Circle.findOne({ id: groupDoc.members }).select("members").lean();
      isMember = membersCircle?.members?.some(m => m.id === viewerId);
    }

    if (!isPublic && !isMember) {
      logger.warn("getGroupTimeline: Access denied", { viewerId, group });
      return [];
    }

    // Query FeedItems for this group
    const query = { group };
    if (since) query.publishedAt = { $gte: new Date(since) };

    return await FeedItems.find(query)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
  } else {
    // Pull from remote server
    return await pullFromRemote({
      domain: groupDomain,
      groups: [group],
      members: [viewerId], // Include viewer to get their addressed posts too
      since,
      limit,
    });
  }
}

/**
 * Event Timeline: Posts addressed to a specific Event
 */
async function getEventTimeline({ viewerId, event, since, limit, ourDomain }) {
  const eventDomain = extractDomain(event);
  const isLocal = eventDomain === ourDomain;

  if (isLocal) {
    // Check if viewer has access to this event
    const eventDoc = await Event.findOne({ id: event }).select("attending rsvpPolicy").lean();
    if (!eventDoc) return [];

    const isPublic = eventDoc.rsvpPolicy === "open";
    let isAttending = false;

    if (!isPublic && eventDoc.attending) {
      const attendingCircle = await Circle.findOne({ id: eventDoc.attending }).select("members").lean();
      isAttending = attendingCircle?.members?.some(m => m.id === viewerId);
    }

    if (!isPublic && !isAttending) {
      logger.warn("getEventTimeline: Access denied", { viewerId, event });
      return [];
    }

    // Query FeedItems for this event
    const query = { event };
    if (since) query.publishedAt = { $gte: new Date(since) };

    return await FeedItems.find(query)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
  } else {
    // Pull from remote server
    return await pullFromRemote({
      domain: eventDomain,
      events: [event],
      members: [viewerId],
      since,
      limit,
    });
  }
}

/**
 * Server Timeline: Public posts from a server
 */
async function getServerTimeline({ viewerId, server, since, limit, ourDomain }) {
  const isLocal = server === ourDomain || server === `@${ourDomain}`;

  if (isLocal) {
    // Query local public/server posts
    const query = {
      $or: [
        { to: "public" },
        { to: "server" },
      ],
    };
    if (since) query.publishedAt = { $gte: new Date(since) };

    return await FeedItems.find(query)
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
  } else {
    // Pull public posts from remote server
    const normalizedDomain = server.replace(/^@/, '');
    return await pullFromRemote({
      domain: normalizedDomain,
      since,
      limit,
    });
  }
}

/**
 * Default Timeline: Combined feed from all sources
 */
async function getDefaultTimeline({ viewerId, since, limit }) {
  // Get all items from Feed collection (pre-fanned local content)
  const query = { actorId: viewerId };
  if (since) query.createdAt = { $gte: new Date(since) };

  const feedItems = await Feed.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Hydrate with FeedItems data
  return await hydrateFeedItems(feedItems.map(f => f.objectId));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Hydrate Feed objectIds with full FeedItems data
 */
async function hydrateFeedItems(objectIds) {
  if (objectIds.length === 0) return [];

  return await FeedItems.find({ id: { $in: objectIds } })
    .sort({ publishedAt: -1 })
    .lean();
}

/**
 * Filter items by checking Group/Event membership
 */
async function filterByMembership(items, viewerId) {
  const filtered = [];

  for (const item of items) {
    if (item.to === "public" || item.to === "server") {
      filtered.push(item);
      continue;
    }

    // Check Group membership
    if (item.group) {
      const groupDoc = await Group.findOne({ id: item.group }).select("members rsvpPolicy").lean();
      if (!groupDoc) continue;

      if (groupDoc.rsvpPolicy === "open") {
        filtered.push(item);
        continue;
      }

      if (groupDoc.members) {
        const membersCircle = await Circle.findOne({ id: groupDoc.members }).select("members").lean();
        if (membersCircle?.members?.some(m => m.id === viewerId)) {
          filtered.push(item);
        }
      }
      continue;
    }

    // Check Event attendance
    if (item.event) {
      const eventDoc = await Event.findOne({ id: item.event }).select("attending rsvpPolicy").lean();
      if (!eventDoc) continue;

      if (eventDoc.rsvpPolicy === "open") {
        filtered.push(item);
        continue;
      }

      if (eventDoc.attending) {
        const attendingCircle = await Circle.findOne({ id: eventDoc.attending }).select("members").lean();
        if (attendingCircle?.members?.some(m => m.id === viewerId)) {
          filtered.push(item);
        }
      }
    }
  }

  return filtered;
}

/**
 * Pull items from a remote server
 */
async function pullFromRemote({ domain, members, authors, groups, events, since, limit }) {
  try {
    const { domain: ourDomain } = getServerSettings();

    // Build query string
    const params = new URLSearchParams();
    if (members) members.forEach(m => params.append('members', m));
    if (authors) authors.forEach(a => params.append('authors', a));
    if (groups) groups.forEach(g => params.append('groups', g));
    if (events) events.forEach(e => params.append('events', e));
    if (since) params.append('since', new Date(since).toISOString());
    if (limit) params.append('limit', limit);

    const url = `https://${domain}/.well-known/kowloon/pull?${params}`;

    logger.info("pullFromRemote: Fetching", { domain, url });

    // TODO: Sign request with HTTP Signature
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/activity+json',
      },
    });

    if (!response.ok) {
      logger.error("pullFromRemote: Failed", {
        domain,
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data = await response.json();
    const items = data.orderedItems || data.items || [];

    logger.info("pullFromRemote: Success", {
      domain,
      count: items.length,
    });

    // Upsert remote items into our FeedItems
    for (const item of items) {
      await FeedItems.findOneAndUpdate(
        { id: item.id },
        { $set: item },
        { upsert: true, new: true }
      );
    }

    return items;
  } catch (error) {
    logger.error("pullFromRemote: Error", {
      domain,
      error: error.message,
      stack: error.stack,
    });
    return [];
  }
}
