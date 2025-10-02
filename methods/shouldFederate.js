// /methods/shouldFederate.js
import * as dotenv from "dotenv";
dotenv.config();

// Activity types that are *always* federated
const ALWAYS_FEDERATE = new Set([
  "Invite", // inviting a remote user
  "Accept", // accepting remote invite
  "Add", // adding remote user to group admin
  "Remove", // removing remote user from group admin
  "Flag", // flagging a remote object
  "Undo", // undoing a federated action
]);

// Utility: extract domain from Kowloon ID or @handle
function domainFromId(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  return at > -1 ? id.slice(at + 1) : null;
}

/**
 * Decide if an Activity should federate beyond the local server.
 *
 * @param {object} activity - Normalized Activity
 * @returns {boolean}
 */
export default function shouldFederate(activity) {
  const localDomain = process.env.DOMAIN || "localhost";
  if (!activity || !activity.type) return false;

  // Explicit override (e.g. user/admin set activity.federate = true)
  if (activity.federate === true) return true;

  // Always federate these types
  if (ALWAYS_FEDERATE.has(activity.type)) return true;

  // Remote-only cases
  const isReply =
    activity.type === "Create" &&
    (activity.objectType === "Reply" || activity.object?.type === "Reply");
  const isUpdateReply =
    activity.type === "Update" &&
    (activity.objectType === "Reply" || activity.object?.type === "Reply");
  const isUpdateReact =
    activity.type === "Update" &&
    (activity.objectType === "React" || activity.object?.type === "React");
  const isReact = activity.type === "React";
  const isJoin = activity.type === "Join";
  const isLeave = activity.type === "Leave";

  // Find a plausible remote target to compare
  const targetId =
    activity?.target ||
    activity?.replyTo ||
    activity?.reactTo ||
    activity?.object?.target ||
    null;

  const targetDomain = domainFromId(targetId);
  const isRemote = targetDomain && targetDomain !== localDomain;

  if ((isReply || isUpdateReply || isUpdateReact || isReact) && isRemote) {
    return true;
  }

  if ((isJoin || isLeave) && isRemote) {
    return true;
  }

  const isFollow = activity.type === "Follow";
  const isUnfollow = activity.type === "Unfollow";

  if ((isFollow || isUnfollow) && isRemote) {
    return true;
  }

  return false;
}
