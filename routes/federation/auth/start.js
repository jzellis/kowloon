// /routes/federation/auth/start.js
import route from "../../utils/route.js";
import Kowloon from "#kowloon";

export default route(async (api) => {
  const { body, setStatus, set } = api;
  const viewer = body?.viewer; // who is asking (remote) to act against us
  const userId = body?.userId; // which remote user will prove possession

  if (!viewer || !userId) {
    setStatus(400);
    set({ error: "viewer and userId are required" });
    return;
  }

  // (Optional) verify server HTTP Signature here if you want to protect the nonce issue
  // const sig = await Kowloon.federation.verifyHttpSignature(api.req);
  // if (!sig.ok) { setStatus(401); set({ error: sig.error }); return; }

  const { nonce, exp } = await Kowloon.federation.auth.startChallenge({
    viewer,
    userId,
  });
  set({ nonce, exp });
});
