import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  const version = process.env.APP_VERSION || "1.0.0";

  res.json({
    version: "2.0",
    software: { name: "kowloon", version },
    protocols: ["activitypub"],
    services: { inbound: [], outbound: [] },
    openRegistrations:
      process.env.OPEN_REGISTRATIONS?.toLowerCase() === "true" ?? true,
    usage: { users: { total: 0 }, localPosts: 0 },
    metadata: {
      siteTitle: process.env.SITE_TITLE || "Kowloon",
      domain,
      instanceActor: `${base}/users/kowloon`,
    },
  });
});

export default router;
