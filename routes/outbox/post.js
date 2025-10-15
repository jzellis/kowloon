// routes/outbox/post.js
import route from "../utils/route.js";
import Kowloon from "#kowloon";

export default route(async ({ req, body, user, set, setStatus }) => {
  console.time("outbox");
  console.log("OUTBOX receive", { actorId: user?.id, ip: req.ip });

  if (!user?.id) {
    setStatus(401);
    set("error", "Unauthorized");
    console.timeEnd("outbox");
    return;
  }

  // Force actorId from auth; never trust the client for this.
  const activity = { ...body, actorId: user.id };

  let created;
  try {
    created = await Kowloon.activities.create(activity);
  } catch (e) {
    setStatus(400);
    set("error", e?.message || "Create threw");
    console.log("OUTBOX error (threw):", e);
    console.timeEnd("outbox");
    return;
  }

  // Nothing came back — treat as error
  if (!created) {
    setStatus(400);
    set("error", "Create returned empty response");
    console.log("OUTBOX error (empty response)");
    console.timeEnd("outbox");
    return;
  }

  if (created.error) {
    setStatus(400);
    set("error", created.error);
    if (created.result !== undefined) set("details", created.result);
    console.log("OUTBOX error:", created);
    console.timeEnd("outbox");
    return;
  }

  set("ok", true);
  set("activity", created.activity);
  set("result", created.result);
  set("federate", !!created.federate);
  console.timeEnd("outbox");
});
