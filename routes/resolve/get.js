// routes/resolve/get.js
// Resolve object by ID for remote servers
import route from "../utils/route.js";
import getObjectById from "#methods/core/getObjectById.js";
import sanitizeObject from "#methods/sanitize/object.js";
import { getViewerContext } from "#methods/visibility/context.js";
import { canSeeObject } from "#methods/visibility/helpers.js";
import Kowloon from "#kowloon";

export default route(async ({ req, query, set, setStatus }) => {
  const { id, actorId } = query;

  if (!id) {
    setStatus(400);
    set("error", "Missing 'id' query parameter");
    return;
  }

  try {
    let viewerId = req.user?.id || null;

    // If actorId is provided, verify HTTP signature to authenticate the remote actor
    if (actorId && !viewerId) {
      const sig = await Kowloon.federation.verifyHttpSignature(req, {
        actorId,
        verifyReplay: false, // Don't verify replay for GET requests
      });

      if (sig.ok) {
        // HTTP signature verified - use the actorId as viewerId
        viewerId = actorId;
      } else {
        // Signature verification failed - log but continue as anonymous
        console.warn("RESOLVE: HTTP signature verification failed for actorId:", actorId, sig.error);
      }
    }

    // Get object with local-only mode
    const result = await getObjectById(id, {
      viewerId,
      mode: "local", // Only return local objects
      enforceLocalVisibility: false, // We'll check visibility ourselves
      hydrateRemoteIntoDB: false, // Don't fetch remote objects
    });

    if (!result || !result.object) {
      setStatus(404);
      set("error", "Object not found");
      return;
    }

    // Check visibility permissions
    const ctx = await getViewerContext(viewerId);
    const canView = await canSeeObject(result.object, ctx);

    if (!canView) {
      setStatus(404); // Return 404 instead of 403 to avoid leaking existence
      set("error", "Object not found");
      return;
    }

    // Sanitize the object to remove sensitive fields
    const sanitized = sanitizeObject(result.object, {
      objectType: result.object.objectType || result.object.type,
    });

    // Return the sanitized object
    setStatus(200);
    set("item", sanitized);
  } catch (error) {
    console.error("RESOLVE: Error resolving object:", error);
    setStatus(500);
    set("error", error.message || "Internal server error");
  }
});
