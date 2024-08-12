module.exports = {
  apps: [
    {
      name: "kowloon",
      script: "./index.js",
      watch: ["./"],
      ignore_watch: ["public", "node_modules"],
    },
  ],
};
