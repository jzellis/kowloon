import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import inbox from "#routes/inbox/index.js";
const router = express.Router({ mergeParams: true });
import Kowloon from "#kowloon";

router.param("id", async (req, _res, next, val) => {
  if (!val.includes("@") && req.method === "GET") {
    const domain = Kowloon.settings.domain;
    if (domain) req.params.id = `@${val}@${domain}`;
  }
  next();
});

router.get("/", collection);
router.get("/:id", id);
router.post("/:id/inbox", inbox);

export default router;
