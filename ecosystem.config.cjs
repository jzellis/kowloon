module.exports = {
  apps: [
    {
      name: "kowloon",
      script: "./index.js",
      watch: ["./"],
      ignore_watch: [
        ".git",
        "public",
        "node_modules",
        "logs",
        "frontend",
        "uploads",
        "images",
      ],
    },
  ],
};
