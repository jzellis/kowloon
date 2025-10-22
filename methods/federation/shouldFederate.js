function extractDomain(id) {
  if (!id || typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  if (at !== -1 && at < id.length - 1) return id.slice(at + 1).toLowerCase();
  try {
    return new URL(id).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isRemote(val, localDomain) {
  const d = extractDomain(val);
  return d && localDomain && d !== localDomain.toLowerCase();
}

export default function shouldFederate(activity, localDomain) {
  const { type, to, target, reactTo, object } = activity;

  // Replies/React/Addressing to remote things
  if (object?.inReplyTo && isRemote(object.inReplyTo, localDomain)) return true;
  if (reactTo && isRemote(reactTo, localDomain)) return true;
  if (to && isRemote(to, localDomain)) return true;
  if (target && isRemote(target, localDomain)) return true;

  // Actor/object-driven verbs
  if (
    [
      "Undo",
      "Delete",
      "Follow",
      "Unfollow",
      "Block",
      "Invite",
      "Join",
      "Leave",
    ].includes(type)
  ) {
    if (activity.object && isRemote(activity.object, localDomain)) return true;
  }

  return false;
}
