// ecosystem.config.cjs
module.exports = {
  apps: [
    { name: "kowloon", script: "node index.js", watch: false, time: true },
  ],
  deploy: {
    dev1: {
      user: "jzellis",
      host: "dev1.example.com",
      port: 22,
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      ssh_options: "StrictHostKeyChecking=no",
      "post-deploy":
        "pnpm install --no-frozen-lockfile && pm2 startOrReload ecosystem.config.cjs --env dev1",
    },
    dev2: {
      user: "jzellis",
      host: "dev2.example.com",
      port: 22,
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      ssh_options: "StrictHostKeyChecking=no",
      "post-deploy":
        "pnpm install --no-frozen-lockfile && pm2 startOrReload ecosystem.config.cjs --env dev2",
    },
  },
};
