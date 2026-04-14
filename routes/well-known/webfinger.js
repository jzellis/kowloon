import express from "express";
import { getSetting } from "#methods/settings/cache.js";
import { User } from "#schema";

const router = express.Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const resource = req.query.resource;
  if (!resource) return res.status(400).json({ error: "Missing ?resource" });

  const domain = getSetting("domain") || process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  let username;

  if (resource.startsWith("acct:")) {
    username = resource.slice(5).split("@")[0];
  } else if (resource.includes("@")) {
    username = resource.split("@")[0].replace(/^@/, "");
  } else {
    username = resource;
  }

  // Verify the user actually exists
  const user = await User.findOne({ username, deletedAt: null }).lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  const actorUrl = user.actorId ?? `${base}/users/${encodeURIComponent(`@${username}@${domain}`)}`;

  const jrd = {
    subject: resource.startsWith("acct:") ? resource : `acct:${username}@${domain}`,
    aliases: [actorUrl],
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: actorUrl,
      },
      {
        rel: "http://webfinger.net/rel/profile-page",
        type: "text/html",
        href: `${base}/users/${encodeURIComponent(user.id)}`,
      },
    ],
  };

  res.set("Content-Type", "application/jrd+json; charset=utf-8");
  res.json(jrd);
});

export default router;
