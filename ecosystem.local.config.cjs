// ecosystem.local.config.cjs
// pm2 config for running three local Kowloon instances for federation testing.
//
// Usage:
//   pm2 start ecosystem.local.config.cjs
//   pm2 stop ecosystem.local.config.cjs
//   pm2 delete ecosystem.local.config.cjs
//
// Prerequisites:
//   - /etc/hosts: 127.0.0.1 kwln1.local kwln2.local kwln3.local
//   - mkcert certs in ./certs/
//   - Caddy running with Caddyfile.local
//   - MongoDB running locally on 27017

// env vars are set inline (env_file is unreliable before dotenv/config runs)
function serverEnv(n) {
  return {
    NODE_ENV: "development",
    PORT: String(3000 + n),
    DOMAIN: `kwln${n}.local`,
    SITE_TITLE: `Kowloon ${n} (local)`,
    ADMIN_EMAIL: `admin@kwln${n}.local`,
    MONGO_URI: `mongodb://localhost:27017/kowloon${n}`,
    JWT_SECRET: `dev-secret-kwln${n}-local`,
    S3_REGION: "us-east-1",
    S3_ENDPOINT: "http://localhost:9000",
    S3_BUCKET: `kwln${n}`,
    S3_ACCESS_KEY: "minioadmin",
    S3_SECRET_KEY: "minioadmin",
    S3_PUBLIC_URL: `http://localhost:9000/kwln${n}`,
  };
}

const watchCommon = {
  watch: true,
  watch_options: { followSymlinks: false, usePolling: false },
  ignore_watch: ["node_modules", "logs", ".git", "*.log", "*.pid", "tests", "certs"],
  autorestart: true,
  max_restarts: 10,
  min_uptime: "5s",
  time: true,
};

module.exports = {
  apps: [
    { ...watchCommon, name: "kwln1",      script: "index.js",           env: serverEnv(1), max_memory_restart: "500M" },
    { ...watchCommon, name: "kwln1-feed", script: "workers/feedFanOut.js", env: serverEnv(1), max_memory_restart: "200M" },
    { ...watchCommon, name: "kwln2",      script: "index.js",           env: serverEnv(2), max_memory_restart: "500M" },
    { ...watchCommon, name: "kwln2-feed", script: "workers/feedFanOut.js", env: serverEnv(2), max_memory_restart: "200M" },
    { ...watchCommon, name: "kwln3",      script: "index.js",           env: serverEnv(3), max_memory_restart: "500M" },
    { ...watchCommon, name: "kwln3-feed", script: "workers/feedFanOut.js", env: serverEnv(3), max_memory_restart: "200M" },
  ],
};
