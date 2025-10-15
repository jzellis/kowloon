import express from "express";
import routes from "#routes/index.js";
import attachUser from "#routes/middleware/attachUser.js";

export async function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(attachUser); // your middleware that resolves req.user from Authorization
  app.use(routes); // your central router
  return app;
}
