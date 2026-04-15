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
//   - mkcert certs in ./certs/ (see README)
//   - Caddy running with Caddyfile.local
//   - MongoDB running locally on 27017

const common = {
  watch: true,
  watch_options: { followSymlinks: false, usePolling: false },
  ignore_watch: ["node_modules", "logs", ".git", "*.log", "*.pid", "tests", "certs"],
  autorestart: true,
  max_restarts: 10,
  min_uptime: "5s",
  max_memory_restart: "500M",
  time: true,
};

const workerCommon = {
  ...common,
  max_memory_restart: "200M",
};

module.exports = {
  apps: [
    // --- kwln1.local (port 3001) ---
    {
      ...common,
      name: "kwln1",
      script: "index.js",
      env_file: ".env.kwln1",
    },
    {
      ...workerCommon,
      name: "kwln1-feed",
      script: "workers/feedFanOut.js",
      env_file: ".env.kwln1",
    },

    // --- kwln2.local (port 3002) ---
    {
      ...common,
      name: "kwln2",
      script: "index.js",
      env_file: ".env.kwln2",
    },
    {
      ...workerCommon,
      name: "kwln2-feed",
      script: "workers/feedFanOut.js",
      env_file: ".env.kwln2",
    },

    // --- kwln3.local (port 3003) ---
    {
      ...common,
      name: "kwln3",
      script: "index.js",
      env_file: ".env.kwln3",
    },
    {
      ...workerCommon,
      name: "kwln3-feed",
      script: "workers/feedFanOut.js",
      env_file: ".env.kwln3",
    },
  ],
};
