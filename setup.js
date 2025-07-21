// setup/setup.js
import express from "express";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 1234;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

const execAsync = promisify(exec);

app.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Kowloon Setup</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100 flex items-center justify-center min-h-screen">
      <form action="/setup" method="POST" class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-md">
        <h1 class="text-xl font-bold mb-4">Kowloon Setup</h1>

        <label class="block mb-2">Site Title
          <input type="text" name="siteTitle" required class="w-full px-3 py-2 border rounded" />
        </label>

        <label class="block mb-2">Domain (no protocol)
          <input type="text" name="domain" required class="w-full px-3 py-2 border rounded" placeholder="example.com" />
        </label>

        <label class="block mb-2">Admin Email
          <input type="email" name="adminEmail" required class="w-full px-3 py-2 border rounded" />
        </label>

        <label class="block mb-4">Admin Password
          <input type="password" name="adminPassword" required class="w-full px-3 py-2 border rounded" />
        </label>

        <button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full">
          Launch Kowloon
        </button>
      </form>
    </body>
    </html>
  `);
});

app.post("/setup", async (req, res) => {
  const { siteTitle, domain, adminEmail, adminPassword } = req.body;

  const envContent = `
PORT=3000
MONGO_URI=mongodb://admin:secret@mongo:27017/kowloon?authSource=admin
STORAGE_TYPE=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=kowloon
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_PUBLIC_URL=http://${domain}/files/
`;

  const setupJson = {
    siteTitle,
    domain,
    adminEmail,
    adminPassword,
  };

  try {
    await fs.writeFile(".env", envContent);
    await fs.writeFile("./setup.tmp", JSON.stringify(setupJson, null, 2));

    const { stdout, stderr } = await execAsync("docker compose up -d --build");
    console.log(stdout);
    res.send(`
        <html>
          <head><title>Setup Complete</title></head>
          <body class="p-4 text-center font-sans">
            <h1 class="text-2xl font-bold text-green-600">✅ Kowloon is setting up.</h1>
            <p>You can close this tab or visit your domain once Docker has finished starting the server.</p>
          </body>
        </html>
      `);
    await fs.unlink("./setup.tmp");
    process.exit(1);
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to write setup files.");
  }
});

app.listen(port, () => {
  console.log(`Setup server running at http://localhost:${port}`);
});
