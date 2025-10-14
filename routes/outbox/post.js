// /routes/outbox/post.js
import route from "../utils/route.js";
import Kowloon from "#kowloon"; // exposes Kowloon.activities.create()

export default route(async (api) => {
  const { body, user, setStatus, set } = api;

  if (!user?.id) {
    setStatus(401);
    set({ error: "Unauthorized" });
    return;
  }

  // Force actorId from auth; never trust the client for this.
  const activity = {
    ...body,
    actorId: user.id,
  };

  const created = await Kowloon.activities.create(activity);

  if (created?.error) {
    api.setStatus(400);
    api.set({ error: created.error, result: created?.result });
    return;
  }

  // created: { activity, result, federate? }
  api.set({
    ok: true,
    activity: created.activity,
    result: created.result,
    federate: !!created.federate,
  });
});
