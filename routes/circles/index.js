import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import members from "./members/index.js";
import replies from "../replies/index.js";
import reacts from "../reacts/index.js";
const router = express.Router({ mergeParams: true });

router.get("/", collection);
router.get("/:id", id);
router.use("/:id/members", members);
router.use("/:id/replies", replies);
router.use("/:id/reacts", reacts);
export default router;
