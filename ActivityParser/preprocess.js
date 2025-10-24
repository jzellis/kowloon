// /ActivityParser/preprocess.js
export default function preprocess(activity = {}) {
  activity = typeof structuredClone === "function"
    ? structuredClone(activity)
    : JSON.parse(JSON.stringify(activity));

  if ("id" in activity) delete activity.id;
  if (activity.type === "Create" && activity.object && typeof activity.object === "object") {
    if ("id" in activity.object) delete activity.object.id;
  }
  if (activity.replyTo && !activity.canReply) { activity.canReply = activity.replyTo; delete activity.replyTo; }
  if (activity.reactTo && !activity.canReact) { activity.canReact = activity.reactTo; delete activity.reactTo; }

  for (const k of ["to", "canReply", "canReact"]) {
    if (Array.isArray(activity[k])) {
      throw new Error(`'${k}' must be a single string, not an array`);
    }
  }

  if (activity.type === "Follow" && activity.object && typeof activity.object === "object") {
    if (activity.object.actorId && typeof activity.object.actorId === "string") {
      activity.object = activity.object.actorId;
    }
  }

  if (activity.type === "Create") {
    const obj = activity.object;
    if (!obj || typeof obj !== "object" || !obj.type) {
      throw new Error("Create: object.type is required");
    }
  }

  if (activity.type === "Reply") {
    const obj = activity.object;
    if (!obj || obj.type !== "Reply" || !obj.inReplyTo) {
      throw new Error("Reply: object.type must be 'Reply' and object.inReplyTo is required");
    }
    if (activity.objectType !== "Post") {
      throw new Error("Reply: objectType must be 'Post'");
    }
  }

  return activity;
}
