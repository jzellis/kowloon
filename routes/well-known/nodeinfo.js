import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  res.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: `${base}/nodeinfo/2.0`,
      },
    ],
  });
});

export default router;
