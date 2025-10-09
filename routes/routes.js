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

// Middleware to check if configured and route accordingly
router.use((req, res, next) => {
  const isConfigured = fs.existsSync(CONFIG_FLAG);

  if (!isConfigured && req.path !== "/setup") {
    console.log("Server not configured - redirecting to /setup");
    return res.redirect("/setup");
  }

  if (isConfigured && req.path === "/setup") {
    console.log("Server already configured - redirecting to /");
    return res.redirect("/");
  }

  next();
});

// Always include setup router (after the middleware check)
router.use(setupRouter);

// Basic home route (only accessible when configured)
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
  const isConfigured = fs.existsSync(CONFIG_FLAG);
  res.json({ status: "ok", configured: isConfigured });
});

export default router;

