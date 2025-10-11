import express from "express";
const router = express.Router();

router.get("/", async (req, res) => {
  const resource = req.query.resource;
  if (!resource) return res.status(400).json({ error: "Missing ?resource" });

  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  let username;

  if (resource.startsWith("acct:")) {
    username = resource.slice(5).split("@")[0];
  } else if (resource.includes("@")) {
    username = resource.split("@")[0];
  } else {
    username = resource;
  }

  const actorUrl = `${base}/users/${encodeURIComponent(username)}`;
  const jrd = {
    subject: resource,
    links: [
      {
        rel: "self",
        type: "application/activity+json",
        href: actorUrl,
      },
    ],
  };

  res.set("Content-Type", "application/jrd+json; charset=utf-8");
  res.json(jrd);
});

export default router;
