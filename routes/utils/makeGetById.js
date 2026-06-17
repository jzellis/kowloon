// /routes/utils/makeGetById.js
import route from "../utils/route.js";
import Kowloon from "#kowloon";
import { getViewerContext } from "#methods/visibility/context.js";
import { canSeeObject } from "#methods/visibility/helpers.js";
import sanitizeObject from "#methods/sanitize/object.js";

/**
 * Creates a GET-by-id route handler that uses Kowloon.get.getObjectById
 *
 * @param {object} opts
 * @param {"local"|"remote"|"prefer-local"|"both"} [opts.mode="local"]  - default local-only
 * @param {boolean} [opts.enforceLocalVisibility=true]                  - public-only if no viewer
 * @param {(req)=>string} [opts.idFromParams]                           - build the global id from params, if needed
 * @param {(viewerId:string|null, doc:object)=>Promise<boolean>} [opts.canView] - custom visibility check (defaults to canSeeObject)
 */
export default function makeGetById({
  mode = "local",
  enforceLocalVisibility = true,
  idFromParams = (req) => decodeURIComponent(req.params.id),
  canView,
} = {}) {
  const defaultCanView = async (viewerId, doc) => {
    const ctx = await getViewerContext(viewerId);
    return canSeeObject(doc, ctx);
  };
  const canViewFn = canView || defaultCanView;

  return route(async ({ req, params, query, set, setStatus }) => {
    const id = idFromParams(req) || decodeURIComponent(params.id);
    const viewerId = req.user?.id || null;

    try {
      const result = await Kowloon.get.getObjectById(id, {
        viewerId,
        mode,
        enforceLocalVisibility,
        canView: canViewFn,
      });

      if (!result || !result.object) {
        setStatus(404);
        set("error", "Not found");
        return;
      }

      // Sanitize the object. For User profiles, audience-gated personal
      // fields are filtered based on viewer context.
      const objectType = result.object.objectType || result.object.type;
      const isUser    = objectType === "User" || objectType === "Person";
      const viewerCtx = isUser ? await getViewerContext(viewerId) : null;
      const sanitized = sanitizeObject(result.object, { objectType, viewer: viewerCtx });

      setStatus(200);
      set("item", sanitized);
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
