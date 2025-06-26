import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = process.cwd();
const CONFIG_FLAG = path.join(__dirname, ".configured");
const ENV_PATH = path.join(__dirname, ".env");

export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();

  if (fs.existsSync(CONFIG_FLAG)) {
    return res.send(
      "<h1>Setup already completed.</h1><p>Please restart the server or remove the .configured file to run setup again.</p>"
    );
  }

  const {
    MONGODB_URI,
    KOWLOON_DOMAIN,
    KOWLOON_ADMIN_USERNAME,
    KOWLOON_ADMIN_PASSWORD,
    KOWLOON_ADMIN_EMAIL,
    S3_ENDPOINT,
    S3_BUCKET,
    S3_REGION,
    S3_ACCESS_KEY,
    S3_ACCESS_SECRET_KEY,
    PORT,
  } = req.body;

  // Basic validation (you can improve this)
  if (
    !MONGODB_URI ||
    !KOWLOON_DOMAIN ||
    !KOWLOON_ADMIN_USERNAME ||
    !KOWLOON_ADMIN_PASSWORD ||
    !KOWLOON_ADMIN_EMAIL ||
    !S3_ENDPOINT ||
    !S3_BUCKET ||
    !S3_REGION ||
    !S3_ACCESS_KEY ||
    !S3_ACCESS_SECRET_KEY ||
    !PORT
  ) {
    return res.status(400).send("All fields are required.");
  }

  const envContent = `
  MONGODB_URI="${MONGODB_URI}"
  KOWLOON_DOMAIN="${KOWLOON_DOMAIN}"
  KOWLOON_ADMIN_USERNAME="${KOWLOON_ADMIN_USERNAME}"
  KOWLOON_ADMIN_PASSWORD="${KOWLOON_ADMIN_PASSWORD}"
  KOWLOON_ADMIN_EMAIL="${KOWLOON_ADMIN_EMAIL}"
  S3_ENDPOINT="${S3_ENDPOINT}"
  S3_BUCKET="${S3_BUCKET}"
  S3_REGION="${S3_REGION}"
  S3_ACCESS_KEY="${S3_ACCESS_KEY}"
  S3_ACCESS_SECRET_KEY="${S3_ACCESS_SECRET_KEY}"
  PORT=${PORT}
  `.trim();

  try {
    if (fs.existsSync(ENV_PATH)) {
      const backupPath = ENV_PATH + ".bak";
      fs.copyFileSync(ENV_PATH, backupPath);
      console.log(`Backed up existing .env to .env.bak`);
    }
    fs.writeFileSync(ENV_PATH, envContent, { mode: 0o600 });
    fs.writeFileSync(CONFIG_FLAG, "configured");

    res.send(`
      <h1>Kowloon Server Setup</h1>
      <form method="POST" action="/setup">
        <label>MONGODB_URI:<br><input name="MONGODB_URI" value="mongodb://localhost:27017/kowloon" required></label><br><br>
        <label>KOWLOON_DOMAIN:<br><input name="KOWLOON_DOMAIN" value="kowloon.social" required></label><br><br>
        <label>KOWLOON_ADMIN_USERNAME:<br><input name="KOWLOON_ADMIN_USERNAME" value="admin" required></label><br><br>
        <label>KOWLOON_ADMIN_PASSWORD:<br><input type="password" name="KOWLOON_ADMIN_PASSWORD" value="admin" required></label><br><br>
        <label>KOWLOON_ADMIN_EMAIL:<br><input name="KOWLOON_ADMIN_EMAIL" value="admin@kowloon.social" required></label><br><br>
        <label>S3_ENDPOINT:<br><input name="S3_ENDPOINT" value="http://localhost:9000" required></label><br><br>
        <label>S3_BUCKET:<br><input name="S3_BUCKET" value="kowloon" required></label><br><br>
        <label>S3_REGION:<br><input name="S3_REGION" value="us-east-1" required></label><br><br>
        <label>S3_ACCESS_KEY:<br><input name="S3_ACCESS_KEY" value="o1zqzIYpJGhbJjH9bXPy" required></label><br><br>
        <label>S3_ACCESS_SECRET_KEY:<br><input name="S3_ACCESS_SECRET_KEY" value="GkqvvPOQ6NUzjZqW9Jm4tNuFnZtNcYuGqI8UXTTL" required></label><br><br>
        <label>PORT:<br><input name="PORT" value="3000" required></label><br><br>
        <button type="submit">Save Configuration</button>
      </form>
    `);

    res.send(
      "<h2>Configuration saved successfully.</h2><p>Please restart the server to apply settings.</p>"
    );
  } catch (err) {
    console.error("Error writing config:", err);
    res.status(500).send("Failed to save configuration.");
  }
}
