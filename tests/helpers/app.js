import express from "express";
import routes from "#routes/index.js";

export async function buildApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  // Note: User authentication is handled by the route wrapper itself
  // via attachUserFromToken() in routes/utils/route.js
  app.use(routes);
  return app;
}
