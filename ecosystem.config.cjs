// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "kowloon-app",
      script: "node ./index.js", // or your entry
      env: { NODE_ENV: "development" },
      env_dev1: { PORT: 4001, INSTANCE: "dev1" },
      env_dev2: { PORT: 4002, INSTANCE: "dev2" },
      // For hot-ish reload on file change (dev only). You can remove if you’ll rely on deploy restarts.
      watch: false, // keep false; we’ll reload on deploy to avoid CPU churn
    },
  ],

  deploy: {
    dev1: {
      user: "jzellis",
      host: "kowloon.network",
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      // ecosystem.config.js (deploy target for dev1)
      "post-deploy":
        "export PATH=/home/jzellis/.nvm/versions/node/v24.7.0/bin:$PATH && pnpm install --frozen-lockfile && npm run --if-present build && pm2 startOrReload ecosystem.config.cjs --env dev1",
    },
    dev2: {
      user: "jzellis",
      host: "kwln.social",
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      "post-deploy":
        "export PATH=$(npm bin -g):$PATH && pnpm i --frozen-lockfile && pnpm build && pm2 startOrReload ecosystem.config.js --env dev1",
    },
  },
};
