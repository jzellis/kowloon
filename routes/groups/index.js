// routes/groups/index.js

import express from "express";
import collection from "./collection.js";
import id from "./id.js";
import members from "./members.js";
import posts from "./posts.js";
import inboxPost from "../inbox/post.js";

const router = express.Router({ mergeParams: true });

router.get("/", collection);
router.get("/:id", id);
router.get("/:id/members", members);
router.get("/:id/posts", posts);
// S2S: remote servers deliver to group inbox
router.post("/:id/inbox", inboxPost);

export default router;
