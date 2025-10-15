// routes/auth/login.js
import express from "express";
import route from "../utils/route.js";
import Kowloon from "#kowloon";

const router = express.Router({ mergeParams: true });

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

    // Don't log passwords
    // console.log("login", username);

    if (
      !username ||
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      setStatus(400);
      set("error", "username and password are required");
      return;
    }

    // Let auth layer do the verification; don't inspect user.password here
    const { user, token, error } = await Kowloon.auth.login(username, password);

    if (error || !user || !token) {
      // No direct res.json — use the route() setters so the wrapper sends once
      setStatus(401);
      set("error", "Invalid credentials");
      return;
    }

    // Optional: belt-and-braces sanitize in case auth.login returned a full doc
    if ("password" in user) delete user.password;

    // Safe to set headers; the wrapper hasn't sent anything yet
    res.set("Authorization", `Bearer ${token}`);

    set("user", user);
    set("token", token);
  })
);

export default router;
