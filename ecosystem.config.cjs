// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "kowloon",
      script: "index.js",
      watch: true,
      time: true,
    },
  ],
  deploy: {
    dev1: {
      user: "jzellis",
      host: "kowloon.network",
      port: 22,
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      ssh_options: "StrictHostKeyChecking=no",
      "post-deploy":
        "/home/jzellis/.nvm/versions/node/v24.7.0/bin/pnpm install --no-frozen-lockfile && /home/jzellis/.nvm/versions/node/v24.7.0/bin/pm2 startOrReload ecosystem.config.cjs --env dev1",
    },
    dev2: {
      user: "jzellis",
      host: "kwln.social",
      port: 22,
      ref: "origin/main",
      repo: "git@github.com:jzellis/kowloon.git",
      path: "/home/jzellis/kowloon",
      ssh_options: "StrictHostKeyChecking=no",
      "post-deploy":
        "/home/jzellis/.nvm/versions/node/v24.7.0/bin/pnpm install --no-frozen-lockfile && /home/jzellis/.nvm/versions/node/v24.7.0/bin/pm2 startOrReload ecosystem.config.cjs --env dev2",
    },
  },
};
