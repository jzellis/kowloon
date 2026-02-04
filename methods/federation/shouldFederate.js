// /methods/federation/shouldFederate.js
// Determines if an Activity should be pushed to remote servers.
// Kowloon uses hybrid federation:
//  - PUSH: Activities that directly interact with remote resources
//  - PULL: Public content fetched via outbox/collections (no push)

import { getSetting } from "#methods/settings/cache.js";

/**
 * Extract domain from various ID formats
 * @param {string} id - Could be @user@domain, group:id@domain, or https://domain/...
 * @returns {string|null} The domain, or null
 */
function extractDomain(id) {
  if (!id || typeof id !== "string") return null;

  // Handle @user@domain or group:id@domain format
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) {
    return id.slice(at + 1).toLowerCase();
  }

  // Handle URL format
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if an ID belongs to a remote server
 * @param {string} val - The ID to check
 * @param {string} localDomain - This server's domain
 * @returns {boolean}
 */
function isRemote(val, localDomain) {
  if (!val || !localDomain) return false;
  const d = extractDomain(val);
  return d !== null && d !== localDomain.toLowerCase();
}

/**
 * Check if activity is addressed to local server (e.g., "@kwln.org")
 * @param {string} to - The addressing field
 * @param {string} localDomain - This server's domain
 * @returns {boolean}
 */
function isAddressedToSelf(to, localDomain) {
  if (!to || !localDomain) return false;
  // Check for @domain format
  if (to === `@${localDomain}` || to === localDomain) return true;
  return false;
}

/**
 * Determine if an Activity should be pushed to remote servers.
 *
 * RULES:
 * 1. Never push if addressed to local server (@kwln.org)
 * 2. Never push to @public (pull-based)
 * 3. Never push Follow/Unfollow/Block/Mute/Circle operations (private)
 * 4. Only push when directly interacting with remote resources
 *
 * @param {Object} activity - The activity to check
 * @returns {boolean} true if should push to remote servers
 */
export default function shouldFederate(activity) {
  if (!activity?.type) return false;

  const localDomain = getSetting("domain") || process.env.DOMAIN;
  if (!localDomain) return false; // Can't determine if remote without knowing local domain

  const { type, to, target, object } = activity;

  // RULE: Never push if addressed to local server
  if (isAddressedToSelf(to, localDomain)) return false;

  // RULE: Never push to @public (pull-based discovery)
  if (to === "@public") return false;

  // RULE: Never push private operations (even if remote resources involved)
  const privateOperations = ["Follow", "Unfollow", "Block", "Mute"];
  if (privateOperations.includes(type)) return false;

  // RULE: Push only when directly interacting with remote resources
  switch (type) {
    case "Create": {
      // Push if creating inside a remote Group
      const targetDomain = extractDomain(target);
      if (targetDomain && isRemote(target, localDomain)) return true;

      // Push if object is being created in remote collection
      const objectTarget = object?.target;
      if (objectTarget && isRemote(objectTarget, localDomain)) return true;

      return false;
    }

    case "Reply": {
      // Push if replying to a remote object
      const inReplyTo = object?.inReplyTo || object?.target || target;
      if (inReplyTo && isRemote(inReplyTo, localDomain)) return true;
      return false;
    }

    case "React": {
      // Push if reacting to a remote object
      const reactTo = object?.target || target || object;
      if (reactTo && isRemote(reactTo, localDomain)) return true;
      return false;
    }

    case "Update":
    case "Delete": {
      // Push if the object being updated/deleted is remote
      const objectId = object?.id || object;
      if (objectId && isRemote(objectId, localDomain)) return true;
      return false;
    }

    case "Accept":
    case "Reject": {
      // Push if accepting/rejecting a remote request
      const requestObject = object?.id || object;
      if (requestObject && isRemote(requestObject, localDomain)) return true;
      return false;
    }

    case "Invite": {
      // Push if inviting to/from remote Group, or inviting remote user
      if (target && isRemote(target, localDomain)) return true; // Remote group
      if (object && isRemote(object, localDomain)) return true; // Remote user
      return false;
    }

    case "Join":
    case "Leave": {
      // Push if joining/leaving a remote Group
      const joinTarget = object?.id || object || target;
      if (joinTarget && isRemote(joinTarget, localDomain)) return true;
      return false;
    }

    case "Add":
    case "Remove": {
      // Push if adding/removing to/from a remote collection
      if (target && isRemote(target, localDomain)) return true;
      const objectId = object?.id || object;
      if (objectId && isRemote(objectId, localDomain)) return true;
      return false;
    }

    case "Undo": {
      // Push if undoing an activity that was previously federated
      // The handler should check if original activity was federated and set federate flag
      // We can't determine this from addressing alone
      return false; // Let handler decide
    }

    case "Flag": {
      // Only push if flagging remote content to its host moderators
      const flaggedObject = object?.id || object;
      if (flaggedObject && isRemote(flaggedObject, localDomain)) return true;
      return false;
    }

    default:
      // Unknown activity type - don't federate by default
      return false;
  }
}
