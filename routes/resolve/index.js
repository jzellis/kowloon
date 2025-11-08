// /routes/resolve/index.js
// Generic endpoint to resolve any object by ID
// GET /resolve?id=@user@domain or /resolve?id=post:xxx@domain
import route from "../utils/route.js";
import getObjectById from "#methods/get/objectById.js";
import sanitizeObject from "#methods/sanitize/object.js";

export default route(
  async ({ query, user, set, setStatus }) => {
    const id = query?.id;

    if (!id) {
      setStatus(400);
      set("error", "Missing 'id' parameter");
      return;
    }

    try {
      // For non-User objects, prefer FeedCache
      let obj = null;
      const isUserQuery = id.startsWith("@");

      if (!isUserQuery) {
        // Try FeedCache first for Posts, Groups, Events, etc.
        const { FeedCache } = await import("#schema");
        const cached = await FeedCache.findOne({ objectId: id }).lean();
        if (cached) {
          obj = cached;
        }
      }

      // Fallback to getObjectById if not in FeedCache or is a User
      if (!obj) {
        const result = await getObjectById(id, {
          viewerId: user?.id || null,
          mode: "local", // Only return local objects (remote fetching is for our own use)
          enforceLocalVisibility: true,
        });
        obj = result?.object;
      }

      if (!obj) {
        setStatus(404);
        set("error", "Not found");
        return;
      }

      // Sanitize the object before returning
      const sanitized = sanitizeObject(obj, {
        objectType: obj.objectType || obj.type,
      });

      setStatus(200);
      // Spread all sanitized properties into the response
      for (const key in sanitized) {
        if (sanitized.hasOwnProperty(key)) {
          set(key, sanitized[key]);
        }
      }
      return;
    } catch (err) {
      if (err.name === "NotFound") {
        setStatus(404);
        set("error", err.message || "Not found");
      } else if (err.name === "NotAuthorized") {
        setStatus(403);
        set("error", err.message || "Not authorized");
      } else if (err.name === "BadRequest") {
        setStatus(400);
        set("error", err.message || "Bad request");
      } else {
        setStatus(500);
        set("error", "Internal server error");
        console.error("Resolve error:", err);
      }
    }
  },
  {
    allowUnauth: true, // Allow unauthenticated access for public objects
    label: "RESOLVE",
  }
);
