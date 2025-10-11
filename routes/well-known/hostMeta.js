import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;

  // Serve XML (default expectation)
  res.set("Content-Type", "application/xrd+xml; charset=utf-8");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/xrd+xml"
        template="${base}/.well-known/webfinger?resource={uri}"/>
</XRD>`);
});

router.get("/.json", (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;
  res.set("Content-Type", "application/json; charset=utf-8");
  res.json({
    links: [
      {
        rel: "lrdd",
        type: "application/jrd+json",
        template: `${base}/.well-known/webfinger?resource={uri}`,
      },
    ],
  });
});

export default router;
