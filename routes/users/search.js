// GET /users/search?q=dave
// Auth-required. Searches users by handle or display name.
// Ignores profile `to` visibility — used for circle member lookup.
// If q looks like @user@domain (remote handle), resolves via WebFinger/actor
// fetch instead of querying the local DB.

import route from "../utils/route.js";
import { User } from "#schema";
import Kowloon from "#kowloon";

const REMOTE_HANDLE_RE = /^@?([^@]+)@([^@]+\.[^@]+)$/;

export default route(
  async ({ query, set, setStatus }) => {
    const q = (query.q || "").trim();
    if (!q) {
      setStatus(400);
      set("error", "Missing 'q' query parameter");
      return;
    }

    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 10), 25);

    // Remote handle: @user@domain or user@domain — resolve via WebFinger
    const remoteMatch = q.match(REMOTE_HANDLE_RE);
    if (remoteMatch) {
      const normalised = `@${remoteMatch[1]}@${remoteMatch[2]}`;
      try {
        const result = await Kowloon.get.getObjectById(normalised, {
          mode: "prefer-remote",
          hydrateRemoteIntoDB: true,
          maxStaleSeconds: 300,
          enforceLocalVisibility: false,
        });
        const u = result?.object;
        if (u) {
          const item = {
            id: u.id,
            username: u.username || remoteMatch[1],
            name: u.profile?.name ?? u.username ?? remoteMatch[1],
            icon: u.profile?.icon ?? null,
            url: u.url ?? null,
          };
          set("orderedItems", [item]);
          set("totalItems", 1);
          return;
        }
      } catch {
        // Fall through to empty result rather than erroring
      }
      set("orderedItems", []);
      set("totalItems", 0);
      return;
    }

    // Local search: handle prefix (@foo) or display name
    const isHandle = q.startsWith("@");
    const term = isHandle ? q.replace(/^@/, "") : q;
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
