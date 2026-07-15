// routes/lookup/index.js
// GET /lookup?id=<kowloon id> — the local→remote counterpart of /resolve.
//
// Auth-required. An authenticated local user asks their own server to resolve
// ANY object by its Kowloon id — local, already-cached, or fetched fresh from a
// remote server (hydrated + cached). Works for users, posts, circles, and
// groups (the id encodes the type). Servers keep their own resource route,
// GET /servers/:domain (own FederatedServer cache), so they're out of scope here.
//
// /resolve = serve OUR objects to others (local-only, anon/signature).
// /lookup  = fetch a remote object for our user (hydrate+cache, auth required).

import express from "express";
import route from "../utils/route.js";
import getObjectById from "#methods/core/getObjectById.js";
import sanitizeObject from "#methods/sanitize/object.js";
import { getViewerContext } from "#methods/visibility/context.js";

const router = express.Router({ mergeParams: true });

router.get(
  "/",
  route(
    async ({ req, query, set, setStatus }) => {
      const id = typeof query.id === "string" ? query.id.trim() : "";
      if (!id) {
        setStatus(400);
        set("error", "Missing 'id' query parameter");
        return;
      }

      try {
        const result = await getObjectById(id, {
          mode: "prefer-local",
          hydrateRemoteIntoDB: true,
          maxStaleSeconds: 300,
          enforceLocalVisibility: false,
        });

        if (!result?.object) {
          setStatus(404);
          set("error", "Not found");
          return;
        }

        const viewer = await getViewerContext(req.user?.id || null);
        const objectType = result.object.objectType || result.object.type;
        set("item", sanitizeObject(result.object, { objectType, viewer }));
      } catch (err) {
        const code =
          err?.name === "NotFound" ? 404 :
          err?.name === "NotAuthorized" ? 403 :
          err?.name === "BadRequest" ? 400 :
          err?.name === "UpstreamError" ? 502 : 500;
        setStatus(code);
        set("error", err.message || "Lookup failed");
      }
    },
    { allowUnauth: false }
  )
);

export default router;
