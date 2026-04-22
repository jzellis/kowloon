// GET /auth/verify-email?token=xxx
// Verifies a user's email address and issues a JWT on success.

import express from "express";
import route from "#routes/utils/route.js";
import generateToken from "#methods/generate/token.js";
import { User } from "#schema";

const verifyEmailHandler = route(
  async ({ query, set, setStatus }) => {
    const { token } = query;
    if (!token || typeof token !== "string") {
      setStatus(400);
      set("error", "Missing verification token");
      return;
    }

    const userDoc = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select("id username type profile prefs publicKey circles emailVerified emailVerificationToken emailVerificationExpires");

    if (!userDoc) {
      setStatus(400);
      set("error", "Invalid or expired verification token");
      return;
    }

    userDoc.emailVerified = true;
    userDoc.emailVerificationToken = undefined;
    userDoc.emailVerificationExpires = undefined;
    await userDoc.save();

    let jwtToken;
    try {
      jwtToken = await generateToken(userDoc.id);
    } catch (err) {
      setStatus(500);
      set("error", `Token generation failed: ${err.message}`);
      return;
    }

    const uo = userDoc.toObject({ depopulate: true });
    set("user", {
      id: uo.id,
      username: uo.username,
      type: uo.type,
      profile: uo.profile,
      prefs: uo.prefs,
      publicKey: uo.publicKey,
      following: uo.circles?.following,
      allFollowing: uo.circles?.allFollowing,
      blocked: uo.circles?.blocked,
      muted: uo.circles?.muted,
    });
    set("token", jwtToken);
  },
  { allowUnauth: true, label: "VERIFY_EMAIL" }
);

const router = express.Router({ mergeParams: true });
router.get("/verify-email", verifyEmailHandler);
export default router;
