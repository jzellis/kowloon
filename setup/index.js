// setup/index.js
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "querystring";
import mongoose from "mongoose";
import { execSync } from "child_process";
import { User, Settings } from "../schema/index.js";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

function serveForm(res) {
  const html = fs.readFileSync(path.join(__dirname, "form.html"), "utf-8");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

function dockerInstalled() {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function generateDockerCompose({ nginxMode, domain, email }) {
  const base = `
version: "3"

services:
  mongo:
    image: mongo:7
    restart: always
    volumes:
      - mongo_data:/data/db
`;

  let nginxService = "";
  let kowloonService = "";

  if (nginxMode === "docker") {
    nginxService = `
  reverse-proxy:
    image: nginxproxy/nginx-proxy
    container_name: reverse-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - ./certs:/etc/nginx/certs:ro
      - ./nginx/html:/usr/share/nginx/html
      - ./nginx/conf.d:/etc/nginx/conf.d
    networks:
      - web

  acme-companion:
    image: nginxproxy/acme-companion
    container_name: acme-companion
    environment:
      - DEFAULT_EMAIL=${email}
    volumes_from:
      - reverse-proxy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./certs:/etc/nginx/certs
      - ./acme:/etc/acme.sh
    depends_on:
      - reverse-proxy
    networks:
      - web
`;
    kowloonService = `
  kowloon:
    build: .
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      - VIRTUAL_HOST=${domain}
      - LETSENCRYPT_HOST=${domain}
      - LETSENCRYPT_EMAIL=${email}
    volumes:
      - /var/lib/kowloon/uploads:/var/lib/kowloon/uploads
    depends_on:
      - mongo
    networks:
      - web
`;
  } else {
    kowloonService = `
  kowloon:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - /var/lib/kowloon/uploads:/var/lib/kowloon/uploads
    depends_on:
      - mongo
`;
  }

  const networks =
    nginxMode === "docker"
      ? `networks:\n  web:\n    name: web\n    driver: bridge`
      : "";
  const final =
    base +
    nginxService +
    kowloonService +
    "\nvolumes:\n  mongo_data:\n\n" +
    networks;

  fs.writeFileSync(
    path.join(__dirname, "..", "docker-compose.yml"),
    final.trim()
  );
}

function generateNginxConf(domain) {
  const conf = `
server {
  listen 80;
  server_name ${domain};

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}`.trim();

  const nginxDir = path.join(__dirname, "..", "nginx");
  fs.mkdirSync(nginxDir, { recursive: true });
  fs.writeFileSync(path.join(nginxDir, "default.conf"), conf);
}

async function createAdminUser({ username, email, displayName, password }) {
  console.log("Connecting to MongoDB to create admin user...");
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await User.deleteMany({});
    const existing = await User.findOne({ username });
    if (existing) {
      console.log(`⚠️ Admin user "${username}" already exists.`);
      return;
    }
    const user = new User({
      username,
      email,
      password,
      isAdmin: true,
      profile: {
        name: displayName,
        // subtitle: "The human, the myth, the legend",
        // description: "I am the admin of this server.",
        // urls: [`https://${settings.domain}`],
        // icon: "https://avatar.iran.liara.run/public",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
      },
    });
    console.log(await user.save());
    console.log(`✅ Admin user "${username}" created.`);
  } catch (err) {
    console.error("❌ Failed to create admin user:", err);
  } finally {
    await mongoose.disconnect();
  }
}

async function insertDefaultSettings(domain, email) {
  const defaultSettings = {
    actorId: `@${domain}`,
    profile: {
      name: "My Kowloon Server",
      subtitle: "My brand new Kowloon server",
      description:
        "<p>This is a new Kowloon server that I've set up. It's going to be a great place for me and my community to share ideas with each other and the world!</p>",
      location: {
        name: "Kowloon Walled City, Hong Kong",
        type: "Place",
        latitude: "22.332222",
        longitude: "114.190278",
      },
      icon: "/images/icons/server.png",
      urls: [`https://${domain}`],
    },
    domain,
    registrationIsOpen: false,
    maxUploadSize: 100,
    defaultPronouns: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
    blocked: [],
    likeEmojis: [
      { name: "Like", emoji: "👍" },
      { name: "Laugh", emoji: "😂" },
      { name: "Love", emoji: "❤️" },
      { name: "Sad", emoji: "😭" },
      { name: "Angry", emoji: "🤬" },
      { name: "Shocked", emoji: "😮" },
      { name: "Puke", emoji: "🤮" },
    ],
    adminEmail: email,
    emailServer: {
      protocol: "smtp",
      host: "localhost",
      username: "test",
      password: "test",
    },
    icon: `https://${domain}/images/icons/server.png`,
  };

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048, // Adjust the key length as per your requirements
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  try {
    await mongoose.connect(process.env.MONGO_URI);
    await Settings.deleteMany({});

    for (const [key, value] of Object.entries(defaultSettings)) {
      await Settings.findOneAndUpdate(
        { name: key },
        { name: key, value },
        { upsert: true, new: true }
      );
    }

    await Settings.findOneAndUpdate(
      {
        name: "publicKey",
      },
      {
        name: "publicKey",
        value: publicKey,
      },
      { upsert: true, new: true }
    );

    await Settings.findOneAndUpdate(
      {
        name: "privateKey",
      },
      {
        name: "privateKey",
        value: privateKey,
      },
      { upsert: true, new: true }
    );
    console.log("✅ Default settings inserted");
  } catch (err) {
    console.error("❌ Failed to insert default settings:", err);
  } finally {
    await mongoose.disconnect();
  }
}

async function handlePost(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));

  req.on("end", async () => {
    const data = parse(body);
    const {
      DEPLOY_MODE,
      NGINX_HANDLING,
      STORAGE_BACKEND,
      DOMAIN,
      SITE_NAME,
      ADMIN_USERNAME,
      ADMIN_EMAIL,
      ADMIN_DISPLAY_NAME,
      ADMIN_PASSWORD,
    } = data;

    if (ADMIN_USERNAME.toLowerCase() === "public") {
      res.writeHead(400, { "Content-Type": "text/html" });
      return res.end(
        `<h1>❌ Invalid username: "public" is a reserved name.</h1>`
      );
    }

    if (DEPLOY_MODE === "docker" && !dockerInstalled()) {
      res.writeHead(400, { "Content-Type": "text/html" });
      return res.end(
        `<h1>❌ Docker not found</h1><p>Please install Docker before continuing.</p>`
      );
    }

    process.env.MONGO_URI =
      DEPLOY_MODE === "docker"
        ? "mongodb://mongo:27017/kowloon"
        : data.MONGO_URI;

    let env = `DEPLOY_MODE=${DEPLOY_MODE}
NGINX_HANDLING=${NGINX_HANDLING}
DOMAIN=${DOMAIN}
SITE_NAME=${SITE_NAME}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME}
STORAGE_BACKEND=${STORAGE_BACKEND}`;

    env +=
      DEPLOY_MODE === "native"
        ? `\nMONGO_URI=${data.MONGO_URI}`
        : `\nMONGO_URI=mongodb://mongo:27017/kowloon`;

    if (STORAGE_BACKEND === "local") {
      env +=
        DEPLOY_MODE === "native"
          ? `\nLOCAL_STORAGE_PATH=${data.LOCAL_STORAGE_PATH}`
          : `\nLOCAL_STORAGE_PATH=/app/uploads`;
    } else if (STORAGE_BACKEND === "s3") {
      env += `\nSTORAGE_KEY=${data.STORAGE_KEY}
STORAGE_SECRET=${data.STORAGE_SECRET}
STORAGE_BUCKET=${data.STORAGE_BUCKET}
S3_REGION=${data.S3_REGION}
S3_ENDPOINT=${data.S3_ENDPOINT}
S3_PUBLIC_URL=${data.S3_PUBLIC_URL}`;
    } else if (STORAGE_BACKEND === "azure") {
      env += `\nAZURE_CONNECTION_STRING=${data.AZURE_CONNECTION_STRING}
AZURE_CONTAINER=${data.AZURE_CONTAINER}
AZURE_PUBLIC_URL=${data.AZURE_PUBLIC_URL}`;
    } else if (STORAGE_BACKEND === "gcs") {
      env += `\nGCS_PROJECT_ID=${data.GCS_PROJECT_ID}
GCS_KEY_FILE=${data.GCS_KEY_FILE}
GCS_BUCKET=${data.GCS_BUCKET}
GCS_PUBLIC_URL=${data.GCS_PUBLIC_URL}`;
    }

    fs.writeFileSync(path.join(__dirname, "..", ".env"), env);
    fs.writeFileSync(
      path.join(__dirname, "..", ".configured"),
      `Configured at ${new Date().toISOString()}\n`
    );

    await insertDefaultSettings(DOMAIN, ADMIN_EMAIL);
    await createAdminUser({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      password: ADMIN_PASSWORD,
    });

    if (DEPLOY_MODE === "docker") {
      generateDockerCompose({
        nginxMode: NGINX_HANDLING,
        domain: DOMAIN,
        email: ADMIN_EMAIL,
      });
    }

    if (NGINX_HANDLING === "external") {
      generateNginxConf(DOMAIN);
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <div style="font-family: sans-serif; padding: 2rem">
        <h1>✅ Setup Complete</h1>
        <p>Your Kowloon configuration has been saved.</p>
        <p>You may now start the application using:</p>
        <pre style="background:#f3f3f3;padding:1em;border-radius:.5em">
${DEPLOY_MODE === "docker" ? "docker-compose up -d" : "node start.js"}
        </pre>
      </div>
    `);

    console.log(`✅ Setup complete using ${DEPLOY_MODE} mode`);
    setTimeout(() => process.exit(0), 2000);
  });
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      serveForm(res);
    } else if (req.method === "POST" && req.url === "/setup") {
      handlePost(req, res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(PORT, () => {
    console.log(`🧙 Kowloon setup wizard running at http://localhost:${PORT}`);
  });
