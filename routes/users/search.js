// GET /users/search?q=dave
// Auth-required. Searches users by handle or display name.
// Ignores profile `to` visibility — used for circle member lookup.

import route from "../utils/route.js";
import { User } from "#schema";

export default route(
  async ({ query, set, setStatus }) => {
    const q = (query.q || "").trim();
    if (!q) {
      setStatus(400);
      set("error", "Missing 'q' query parameter");
      return;
    }

    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 10), 25);

    // If input looks like a handle (@foo or @foo@domain), search username field
    // Otherwise search both username and display name
    const isHandle = q.startsWith("@");
    const term = isHandle ? q.replace(/^@/, "").split("@")[0] : q;
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const filter = {
      active: true,
      deletedAt: null,
      $or: isHandle
        ? [{ username: re }]
        : [{ username: re }, { "profile.name": re }],
    };

    const docs = await User.find(filter)
      .select("id username profile.name profile.icon url")
      .limit(limit)
      .lean();

    const items = docs.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.profile?.name ?? u.username,
      icon: u.profile?.icon ?? null,
      url: u.url,
    }));

    set("orderedItems", items);
    set("totalItems", items.length);
  },
  { allowUnauth: false }
);
