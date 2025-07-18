// routes/setup.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import express from "express";
const router = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(".env");

router.get("/setup", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/setup.html"));
});

router.post("/setup", express.urlencoded({ extended: true }), (req, res) => {
  const {
    SITE_NAME,
    ADMIN_USERNAME,
    ADMIN_EMAIL,
    ADMIN_DISPLAY_NAME,
    ADMIN_PASSWORD,
    MONGO_URI,
    STORAGE_BACKEND,
    STORAGE_KEY,
    STORAGE_SECRET,
    STORAGE_BUCKET,
    S3_REGION,
    S3_ENDPOINT,
    S3_PUBLIC_URL,
    AZURE_CONNECTION_STRING,
    AZURE_CONTAINER,
    AZURE_PUBLIC_URL,
    GCS_PROJECT_ID,
    GCS_KEY_FILE,
    GCS_BUCKET,
    GCS_PUBLIC_URL,
    LOCAL_STORAGE_PATH,
  } = req.body;

  const lines = [
    `SITE_NAME=${SITE_NAME}`,
    `ADMIN_USERNAME=${ADMIN_USERNAME}`,
    `ADMIN_EMAIL=${ADMIN_EMAIL}`,
    `ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME}`,
    `ADMIN_PASSWORD=${ADMIN_PASSWORD}`,
    `MONGO_URI=${MONGO_URI}`,
    `STORAGE_BACKEND=${STORAGE_BACKEND}`,
    `STORAGE_KEY=${STORAGE_KEY}`,
    `STORAGE_SECRET=${STORAGE_SECRET}`,
    `STORAGE_BUCKET=${STORAGE_BUCKET}`,
    `S3_REGION=${S3_REGION}`,
    `S3_ENDPOINT=${S3_ENDPOINT}`,
    `S3_PUBLIC_URL=${S3_PUBLIC_URL}`,
    `AZURE_CONNECTION_STRING=${AZURE_CONNECTION_STRING}`,
    `AZURE_CONTAINER=${AZURE_CONTAINER}`,
    `AZURE_PUBLIC_URL=${AZURE_PUBLIC_URL}`,
    `GCS_PROJECT_ID=${GCS_PROJECT_ID}`,
    `GCS_KEY_FILE=${GCS_KEY_FILE}`,
    `GCS_BUCKET=${GCS_BUCKET}`,
    `GCS_PUBLIC_URL=${GCS_PUBLIC_URL}`,
    `LOCAL_STORAGE_PATH=${LOCAL_STORAGE_PATH}`,
  ];

  const envContent = lines.filter(Boolean).join("\n");

  fs.writeFileSync(envPath, envContent);
  fs.writeFileSync(".configured", "true\n");

  // Optionally re-run any init scripts if needed here
  // execSync("npm run init-db");

  res.redirect("/");
});

export default router;
