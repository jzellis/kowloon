// routes/push — device push-token registration.
//   POST /push/register    { token, provider?, platform? }  (auth)
//   POST /push/unregister  { token }                         (auth)
//
// The mobile app registers its push token here on login and removes it on
// logout. `provider` tags the delivery backend ("expo" now, "native" later);
// see schema/PushToken.js and methods/push/send.js.

import express from "express";
import route from "../utils/route.js";
import { PushToken } from "#schema";

const router = express.Router({ mergeParams: true });

function requireAuth(user, setStatus, set) {
  if (!user?.id) {
    setStatus(401);
    set("error", "Authentication required");
    return false;
  }
  return true;
}

// POST /push/register
router.post(
  "/register",
  route(async ({ body, user, set, setStatus }) => {
    if (!requireAuth(user, setStatus, set)) return;

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const provider = body?.provider === "native" ? "native" : "expo";
    const platform = ["ios", "android", "web"].includes(body?.platform)
      ? body.platform
      : "android";

    if (!token) {
      setStatus(400);
      return set("error", "token is required");
    }

    // Upsert by token: one row per device, always owned by the current user
    // (handles account switching on the same device).
    await PushToken.findOneAndUpdate(
      { token },
      {
        $set: { userId: user.id, provider, platform, lastSeenAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    set("ok", true);
  })
);

// POST /push/unregister
router.post(
  "/unregister",
  route(async ({ body, user, set, setStatus }) => {
    if (!requireAuth(user, setStatus, set)) return;

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
      setStatus(400);
      return set("error", "token is required");
    }

    await PushToken.deleteOne({ token, userId: user.id });
    set("ok", true);
  })
);

export default router;
