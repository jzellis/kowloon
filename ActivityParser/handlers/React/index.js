// /ActivityParser/handlers/Reply/index.js

import Create from "../Create/index.js";

export default async function Reply(activity) {
  try {
    if (!activity?.object || typeof activity.object !== "object") {
      return { activity, error: "Reply: missing activity.object" };
    }

    // Force Reply semantics: treat it as a Create of a Reply object
    activity.objectType = "React";

    // Delegate to Create handler (will set objectId, sideEffects, etc.)
    return await Create(activity);
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
