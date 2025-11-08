// /routes/resolve/index.js
// Generic endpoint to resolve any object by ID
// GET /resolve?id=@user@domain or /resolve?id=post:xxx@domain
import route from "../utils/route.js";
import getObjectById from "#methods/get/objectById.js";

export default route(
  async ({ query, user, set, setStatus }) => {
    const id = query?.id;

    if (!id) {
      setStatus(400);
      set("error", "Missing 'id' parameter");
      return;
    }

    try {
      const result = await getObjectById(id, {
        viewerId: user?.id || null,
        mode: "local", // Only return local objects (remote fetching is for our own use)
        enforceLocalVisibility: true,
      });

      if (!result?.object) {
        setStatus(404);
        set("error", "Not found");
        return;
      }

      setStatus(200);
      set("object", result.object);
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
