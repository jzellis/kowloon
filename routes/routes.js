// Minimal working routes for Kowloon
import Kowloon from "../Kowloon.js";
import express from "express";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Import setup router
import setupRouter from "./setup/index.js";

const CONFIG_FLAG = path.join(process.cwd(), ".configured");

// Check if server is configured
if (!fs.existsSync(CONFIG_FLAG)) {
  console.log("Server not configured - redirecting to setup");

  // Use the setup router
  router.use(setupRouter);

  // Redirect all other requests to setup
  router.use((req, res) => {
    if (req.path !== "/setup") {
      return res.redirect("/setup");
    }
  });
} else {
  console.log("Server configured - loading routes");

  // Basic home route
  router.get("/", (req, res) => {
    res.json({
      name: "Kowloon",
      version: "1.0.0",
      status: "running",
      message: "Kowloon server is running. This is a federated social networking platform."
    });
  });

  // Health check
  router.get("/health", (req, res) => {
    res.json({ status: "ok", configured: true });
  });
}

export default router;

