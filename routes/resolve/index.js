import express from "express";
import attachUser from "#routes/middleware/attachUser.js";
import {
  NotFound,
  NotAuthorized,
  BadRequest,
} from "#methods/get/objectById.js";
import Kowloon from "#kowloon";
const router = express.Router({ mergeParams: true });

function parseHandle(h) {
  const m = typeof h === "string" ? h.match(/^@([^@]+)@(.+)$/) : null;
  return m ? { username: m[1], domain: m[2] } : null;
}
try {
  router.get("/", attachUser, async (req, res) => {
    try {
      const id = req.query.id;
      if (!id) throw new BadRequest("Missing ?id");

      const localDomain = (
        Kowloon.settings.domain ||
        process.env.DOMAIN ||
        ""
      ).toLowerCase();

      // Object id resolution (local-only)
      const parsed = Kowloon.parse.kowloonId(id);
      if (!parsed?.server) throw new BadRequest("Invalid id");
      if (parsed.server.toLowerCase() !== localDomain)
        return res.status(404).json({ error: "Not found" });

      const viewerId = req.user?.id || null;
      try {
        const result = await Kowloon.get.objectById(id, {
          viewerId,
          mode: "local",
          enforceLocalVisibility: true,
          hydrateRemoteIntoDB: false,
        });

        return res.status(200).json(result.object);
      } catch (e) {
        return res.send("Fail");
        console.error(e);
      }
    } catch (err) {
      if (err instanceof NotFound)
        return res.status(404).json({ error: err.message });
      if (err instanceof NotAuthorized)
        return res.status(403).json({ error: err.message });
      if (err instanceof BadRequest)
        return res.status(400).json({ error: err.message });
      req.app?.locals?.logger?.error?.(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
} catch (e) {
  console.error(e);
}
export default router;
