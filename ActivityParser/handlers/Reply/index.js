// #ActivityParser/handlers/Reply/index.js
// Canonicalizes Reply → Create/Post with object.type = "Reply" and calls Create handler.

import Create from "../Create/index.js";

export default async function Reply(activity, ctx = {}) {
  const a = { ...activity };
  a.type = "Create";
  a.objectType = "Post";
  a.object = { ...(a.object || {}) };

  if (!a.object.inReplyTo || typeof a.object.inReplyTo !== "string") {
    return { activity: a, error: "Reply: object.inReplyTo (string) is required" };
  }

  a.object.type = "Reply";

  // Delegate to Create handler to persist the Post/Reply
  return await Create(a, ctx);
}
