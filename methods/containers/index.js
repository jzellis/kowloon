// /methods/containers/index.js
// Unified interface for Circle/Group/Event container operations

import * as circles from "./circles.js";
import * as groups from "./groups.js";
import * as events from "./events.js";
import { Circle, Group, Event } from "#schema";

/**
 * Get members from any container type (Circle, Group, or Event)
 * @param {string} containerId - Container ID (circle:*, group:*, or event:*)
 * @returns {Promise<Array<{id: string, name?: string, icon?: string}>>}
 */
export async function getMembers(containerId) {
  if (!containerId) return [];

  if (containerId.startsWith("circle:")) {
    return circles.getMembers(containerId);
  } else if (containerId.startsWith("group:")) {
    return groups.getMembers(containerId);
  } else if (containerId.startsWith("event:")) {
    return events.getMembers(containerId);
  }

  return [];
}

/**
 * Get member IDs from any container type
 * @param {string} containerId - Container ID
 * @returns {Promise<string[]>}
 */
export async function getMemberIds(containerId) {
  if (!containerId) return [];

  if (containerId.startsWith("circle:")) {
    return circles.getMemberIds(containerId);
  } else if (containerId.startsWith("group:")) {
    return groups.getMemberIds(containerId);
  } else if (containerId.startsWith("event:")) {
    return events.getMemberIds(containerId);
  }

  return [];
}

/**
 * Get server domains from any container type
 * @param {string} containerId - Container ID
 * @returns {Promise<string[]>}
 */
export async function getServerDomains(containerId) {
  if (!containerId) return [];

  if (containerId.startsWith("circle:")) {
    return circles.getServerDomains(containerId);
  } else if (containerId.startsWith("group:")) {
    return groups.getServerDomains(containerId);
  } else if (containerId.startsWith("event:")) {
    return events.getServerDomains(containerId);
  }

  return [];
}

/**
 * Check if a user is a member of any container type
 * @param {string} containerId - Container ID
 * @param {string} userId - User ID
 * @returns {Promise<boolean>}
 */
export async function isMember(containerId, userId) {
  if (!containerId || !userId) return false;

  if (containerId.startsWith("circle:")) {
    return circles.isMember(containerId, userId);
  } else if (containerId.startsWith("group:")) {
    return groups.isMember(containerId, userId);
  } else if (containerId.startsWith("event:")) {
    return events.isMember(containerId, userId);
  }

  return false;
}

/**
 * Get container metadata (name, description, etc.)
 * @param {string} containerId - Container ID
 * @returns {Promise<Object|null>}
 */
export async function getContainer(containerId) {
  if (!containerId) return null;

  if (containerId.startsWith("circle:")) {
    return Circle.findOne({ id: containerId }).lean();
  } else if (containerId.startsWith("group:")) {
    return Group.findOne({ id: containerId }).lean();
  } else if (containerId.startsWith("event:")) {
    return Event.findOne({ id: containerId }).lean();
  }

  return null;
}

// Export type-specific utilities
export { circles, groups, events };

export default {
  getMembers,
  getMemberIds,
  getServerDomains,
  isMember,
  getContainer,
  circles,
  groups,
  events,
};
