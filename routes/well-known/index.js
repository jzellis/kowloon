import express from "express";
import jwks from "./jwks.js";
import publicKey from "./publicKey.js";
import webfinger from "./webfinger.js";
import hostMeta from "./hostMeta.js";
import nodeinfo from "./nodeinfo.js";
import nodeinfo20 from "./nodeinfo20.js";
import actor from "./actor.js";

const router = express.Router({ mergeParams: true });

// Mount well-known subroutes
router.use("/jwks.json", jwks);
router.use("/public.pem", publicKey);
router.use("/publickey.pem", publicKey);
router.use("/webfinger", webfinger);
router.use("/host-meta", hostMeta);
router.use("/nodeinfo", nodeinfo);
router.use("/actor", actor);
// The /nodeinfo/2.0 document (not technically in .well-known, but linked from it)
router.use("/../nodeinfo/2.0", nodeinfo20); // relative mount so it's served at /nodeinfo/2.0

export default router;
