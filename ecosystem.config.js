module.exports = {
  apps: [
    {
      name: "kowloon-server",
      cwd: "./server",
      script: "./bin/www.js",
      env: {
        NODE_ENV: "production",
      },
      watch: true,
    },
    {
      name: "kowloon-client",
      cwd: "./client",
      script: "npm run dev",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
