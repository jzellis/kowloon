// /routes/federation/pull/post.js
import route from "../../utils/route.js";
import Kowloon from "#kowloon"; // <- use Kowloon singleton, not direct imports

export default route(async (api) => {
  const { body, headers, setStatus, set } = api;

  // Basic shape checks
  const viewer = body?.viewer; // local ID of the requester (e.g. "@alice@their.dom")
  const members = Array.isArray(body?.members) ? body.members : null;
  const since = body?.since ?? null;
  const limit = Number.isFinite(+body?.limit)
    ? Math.max(1, +body.limit)
    : undefined;

  if (!viewer || !members) {
    setStatus(400);
    set({ error: "Invalid request: require { viewer, members[] }" });
    return;
  }

  // TODO: Verify HTTP Signature / Date / Digest / anti-replay here
  // const verified = await Kowloon.federation.verifySignature({ headers, body });
  // if (!verified?.ok) {
  //   setStatus(401);
  //   set({ error: verified?.error || "Unauthorized" });
  //   return;
  // }

  // Delegate selection to Kowloon -- this should return { items, next? }
  // items: array of minimal objects (id,type,actorId,createdAt,visibility, ...snapshot)
  // next:  opaque cursor or ISO timestamp the caller should use on their next request
  const result = await Kowloon.federation.handlePull({
    viewer,
    members,
    since,
    limit,
    headers, // handy if your selector wants requester domain info
  });

  if (result?.error) {
    setStatus(400);
    set({ error: result.error });
    return;
  }

  setStatus(200);
  set({
    items: Array.isArray(result?.items) ? result.items : [],
    ...(result?.next ? { next: result.next } : {}),
  });
});
