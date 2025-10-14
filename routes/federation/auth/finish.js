// /routes/federation/auth/finish.js
import route from "../../utils/route.js";
import Kowloon from "#kowloon";

// (Optional) You can verify a signature over the nonce here if you’re doing key-possession.
// For now we show JWT validation + (optional) DPoP or server HTTP Signature.

export default route(async (api) => {
  const { body, setStatus, set, req } = api;

  const viewer = body?.viewer;
  const userId = body?.userId;
  const nonce = body?.nonce;

  if (!viewer || !userId || !nonce) {
    setStatus(400);
    set({ error: "viewer, userId and nonce are required" });
    return;
  }

  // 1) Verify the remote user's JWT (and optional DPoP)
  const authz = req.get("Authorization");
  const dpop = req.get("DPoP");
  const expectedAud = `${req.protocol}://${req.get("Host")}`;

  const user = await Kowloon.auth.verifyRemoteUser({
    authz,
    dpop,
    expectedAud,
  });
  if (!user.ok || user.user.id !== userId) {
    setStatus(401);
    set({ error: user.error || "User token invalid", details: user });
    return;
  }

  // 2) Optionally, also require the **server** to HTTP-sign this request:
  // const sig = await Kowloon.federation.verifyHttpSignature(req);
  // if (!sig.ok) { setStatus(401); set({ error: sig.error }); return; }

  // 3) If you implement key-possession, verify signature over nonce here:
  // const sigOk = await verifyUserSignature({ userId, nonce, signature: body.signature })
  // const result = await Kowloon.federation.auth.finishChallenge({ viewer, userId, nonce, verified: sigOk });

  // For now, just mark challenge as complete on JWT success:
  const result = await Kowloon.federation.auth.finishChallenge({
    viewer,
    userId,
    nonce,
    verified: true,
  });

  if (!result.ok) {
    setStatus(400);
    set({ error: result.error });
    return;
  }

  set({ ok: true, user: user.user });
});
