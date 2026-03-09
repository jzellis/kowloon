// routes/admin/index.js
// Admin API — all routes require server admin membership

import express from "express";
import { jwtVerify, importSPKI } from "jose";
import isServerAdmin from "#methods/auth/isServerAdmin.js";
import getSettings from "#methods/settings/get.js";
import { create, list, getOne, deactivate } from "./invites.js";

const router = express.Router({ mergeParams: true });

// Admin auth guard middleware
router.use(async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const match = auth.match(/^(?:Bearer|Token)\s+(.+)$/i);
    const token = match?.[1]?.trim();

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const settings = await getSettings();
    const pub = settings?.publicKey?.replace(/\\n/g, "\n").trim();
    if (!pub) return res.status(500).json({ error: "Server misconfigured" });

    const publicKey = await importSPKI(pub, "RS256");
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `https://${settings.domain}`,
    });

    const userId = payload?.user?.id || payload?.id || payload?.sub;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const admin = await isServerAdmin(userId);
    if (!admin) {
      return res.status(403).json({ error: "Server admin access required" });
    }

    req.user = payload.user || { id: userId };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

// ── Invites ───────────────────────────────────────────────────────────────────

router.post("/invites", create);
router.get("/invites", list);
router.get("/invites/:id", getOne);
router.delete("/invites/:id", deactivate);

export default router;
