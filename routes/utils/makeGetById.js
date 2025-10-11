// /routes/utils/makeGetById.js
import route from "../utils/route.js";

/**
 * Creates a GET-by-id route handler that uses Kowloon.get.objectById
 *
 * @param {object} opts
 * @param {"local"|"remote"|"prefer-local"|"both"} [opts.mode="local"]  - default local-only
 * @param {boolean} [opts.enforceLocalVisibility=true]                  - public-only if no viewer
 * @param {(req)=>string} [opts.idFromParams]                           - build the global id from params, if needed
 */
export default function makeGetById({
  mode = "local",
  enforceLocalVisibility = true,
  idFromParams = (req) => decodeURIComponent(req.params.id),
} = {}) {
  return route(async ({ req, params, query, set, setStatus }) => {
    const id = idFromParams(req) || decodeURIComponent(params.id);
    const viewerId = req.user?.id || null;

    try {
      const result = await req.Kowloon.get.objectById(id, {
        viewerId,
        mode,
        enforceLocalVisibility,
        // If your objectById supports projection, you can pass select:
        // select: query.select,
      });

      if (!result || !result.object) {
        setStatus(404);
        set("error", "Not found");
        return;
      }

      setStatus(200);
      set("item", result.object);
    } catch (err) {
      // Map common errors if your implementation throws typed errors
      const code =
        err?.status ||
        (err?.name === "NotAuthorized"
          ? 403
          : err?.name === "NotFound"
          ? 404
          : err?.name === "BadRequest"
          ? 400
          : 500);

      console.error(`GET ${req.originalUrl} error:`, err);
      setStatus(code);
      set("error", err.message || "Internal Server Error");
    }
  });
}
