// ActivityParser/Reply.js
import Create from "./Create.js";

// Alias verb "Reply" -> Create's Reply branch
export default function Reply(activity = {}) {
  const obj = activity.object || {};
  return Create({
    ...activity,
    objectType: "Reply",
    object: {
      ...obj,
      // prefer explicit object.target; fall back to canReply (singular)
      target: obj.target || activity.canReply,
      // optional: set a type for downstream UI
      type: obj.type || "Reply",
    },
  });
}
