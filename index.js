// index.js
import fs from "fs";

const isConfigured =
  fs.existsSync(process.cwd() + "/.configured") &&
  fs.existsSync(process.cwd() + "/.env") &&
  fs
    .readFileSync(process.cwd() + "/.configured", "utf-8")
    .includes("Configured");

if (!isConfigured) {
  console.log("🧙 Launching Kowloon setup wizard...");
  await import("./setup/index.js");
} else {
  console.log("🚀 Starting Kowloon server...");
  await import("./server.js");
}
