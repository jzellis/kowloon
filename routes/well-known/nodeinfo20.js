import express from "express";
import { User, Post } from "#schema";
import getSettings from "#methods/settings/get.js";

const router = express.Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  const version = process.env.APP_VERSION || "1.0.0";

  const [settings, userTotal, localPosts] = await Promise.all([
    getSettings().catch(() => ({})),
    User.countDocuments({ deletedAt: null }).catch(() => 0),
    Post.countDocuments({ deletedAt: null }).catch(() => 0),
  ]);

  const registrationIsOpen = settings?.registrationIsOpen !== false;
  const siteTitle = settings?.profile?.name || process.env.SITE_TITLE || "Kowloon";

  res.json({
    version: "2.0",
    software: { name: "kowloon", version },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations: registrationIsOpen,
    usage: { users: { total: userTotal }, localPosts },
    metadata: {
      siteTitle,
      domain,
      instanceActor: `${base}/users/kowloon`,
    },
  });
});

export default router;
