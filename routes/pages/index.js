// routes/pages/index.js
import express from "express";
import collection from "./collection.js";
import pathView from "./path.js";
import idView from "./id.js"; // Optional: keep if you want a dedicated /pages/id/:id

const router = express.Router();

router.get("/", collection);

// If you prefer dedicated ID route: /pages/id/:id
router.get("/id/:id", idView);

// Catch-all for slug or nested slug paths or even full id as /pages/<id>
// Example: /pages/about or /pages/docs/getting-started/cli
router.get("/*", pathView);

export default router;
