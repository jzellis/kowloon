import express from "express";
const router = express.Router({ mergeParams: true });
import Kowloon from "#kowloon";
/**
 * /.well-known/actor
 * Returns a minimal "instance actor" JSON-LD object representing the server itself.
 * Other servers can fetch this to communicate instance-to-instance.
 */
router.get("/", (req, res) => {
  const domain = process.env.DOMAIN || "localhost";
  const base = `https://${domain}`;

  const actor = {
    "@context": [
      "https://www.w3.org/ns/activitystreams",
      "https://w3id.org/security/v1",
    ],
    id: `${base}/actor`,
    type: "Application",
    preferredUsername: "kowloon",
    name: process.env.SITE_TITLE || "Kowloon",
    summary: "Official instance actor for this Kowloon server.",
    inbox: `${base}/inbox`,
    outbox: `${base}/outbox`,
    followers: `${base}/followers`,
    following: `${base}/following`,
    url: base,
    publicKey: {
      id: `${base}/actor#main-key`,
      owner: `${base}/actor`,
      publicKeyPem: Kowloon.settings.publicKey || "replace-with-real-key",
    },
  };

  res.set("Content-Type", "application/activity+json; charset=utf-8");
  res.json(actor);
});

export default router;
