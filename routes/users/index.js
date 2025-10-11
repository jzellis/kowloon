import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import replies from "../replies/index.js";
import reacts from "../reacts/index.js";
import bookmarks from "./bookmarks.js";
import inbox from "../inbox/index.js";
const router = express.Router();
router.get("/", collection);
router.get("/:id", id);
router.use("/:id/replies", replies);
router.use("/:id/reacts", reacts);
router.get("/:id/bookmarks", bookmarks);
router.get("/:id/inbox", inbox);

export default router;
