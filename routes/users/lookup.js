// GET /users/lookup?id=@bob@kwln2.local
// Auth-required. Resolves a user profile locally or via remote WebFinger/actor fetch.
// Identical pattern to /preview — server proxies the outbound request, no CORS needed.

import route from "../utils/route.js";
import Kowloon from "#kowloon";
import sanitizeObject from "#methods/sanitize/object.js";
import { getViewerContext } from "#methods/visibility/context.js";

export default route(
  async ({ req, query, set, setStatus }) => {
    const { id } = query;

    if (!id) {
      setStatus(400);
      set("error", "Missing 'id' query parameter");
      return;
    }

    try {
      const result = await Kowloon.get.getObjectById(id.trim(), {
        mode: "prefer-local",
        hydrateRemoteIntoDB: true,
        maxStaleSeconds: 300,
        enforceLocalVisibility: false,
      });

      if (!result?.object) {
        setStatus(404);
        set("error", "User not found");
        return;
      }

      const viewer    = await getViewerContext(req.user?.id || null);
      const sanitized = sanitizeObject(result.object, { objectType: "User", viewer });
      set("item", sanitized);
    } catch (err) {
      const code =
        err?.name === "NotFound"    ? 404 :
        err?.name === "NotAuthorized" ? 403 :
        err?.name === "BadRequest"  ? 400 :
        err?.name === "UpstreamError" ? 502 : 500;
      setStatus(code);
      set("error", err.message || "Lookup failed");
    }
  },
  { allowUnauth: false }
);
