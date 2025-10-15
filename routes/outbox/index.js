// routes/outbox/index.js
import express from "express";
import post from "./post.js";
import attachUser from "../middleware/attachUser.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router({ mergeParams: true });

// 🔎 put ping BEFORE attachUser to bypass it
router.get("/__ping", (req, res) => {
  console.log("OUTBOX __ping (pre-auth)");
  res.json({ ok: true });
});

router.use(attachUser); // everything below this needs auth parsing
router.post("/", requireUser, post); // auth only on POST

export default router;
