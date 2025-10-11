// routes/auth/login.js
import express from "express";
import route from "../utils/route.js";
import login from "#methods/auth/login.js";

const router = express.Router();

/**
 * POST /auth/login
 * Body: { username, password }
 * Response: { user, token, queryTime }
 * Also sets `Authorization: Bearer <token>` header for convenience.
 */
router.post(
  "/login",
  route(async ({ req, res, body, set, setStatus }) => {
    const { username, password } = body || {};

    if (
      !username ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      setStatus(400);
      set("error", "username and password are required");
      return;
    }

    const { user, token, error } = await login(username, password);

    if (error) {
      setStatus(401);
      set("error", "Invalid credentials");
      return;
    }

    // ✅ Set Authorization header for clients that want to grab it directly
    res.set("Authorization", `Bearer ${token}`);

    set("user", user);
    set("token", token);
  })
);

export default router;
