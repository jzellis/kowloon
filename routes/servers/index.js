// routes/servers/index.js
// Browse remote Kowloon servers known to this server.
//
// GET /servers          — paginated list of known servers
// GET /servers/:domain  — full profile for a specific server (auto-fetches if stale)
//
// Both routes require authentication — any logged-in user may browse,
// but we don't want unauthenticated requests triggering remote fetches.

import express from "express";
import route from "../utils/route.js";
import { FederatedServer } from "#schema";
import { fetchRemoteServerProfile } from "#methods/federation/index.js";

const router = express.Router({ mergeParams: true });

// ── GET /servers ──────────────────────────────────────────────────────────────
// Paginated list of servers this server knows about.
// Excludes suspended servers by default.

router.get(
  "/",
  route(async ({ query, user, set, setStatus }) => {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const page  = Math.max(1, parseInt(query.page,  10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);
    const skip  = (page - 1) * limit;
    const sort  = query.sort === "name" ? { name: 1 } : { discoveredAt: -1 };

    const filter = {
      status: { $ne: "suspended" },
      name:   { $exists: true },   // only servers we've actually profiled
    };

    const [docs, total] = await Promise.all([
      FederatedServer.find(filter)
        .select("domain name icon image description language location userCount postCount openRegistrations status discoveredAt discoveredVia")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      FederatedServer.countDocuments(filter),
    ]);

    set("type", "OrderedCollection");
    set("totalItems", total);
    set("page", page);
    set("itemsPerPage", limit);
    set("totalPages", Math.ceil(total / limit));
    set("orderedItems", docs.map(({ _id, __v, ...s }) => s));

    if (page * limit < total) set("next", `/servers?page=${page + 1}&limit=${limit}`);
    if (page > 1)             set("prev", `/servers?page=${page - 1}&limit=${limit}`);
  })
);

// ── GET /servers/:domain ──────────────────────────────────────────────────────
// Full cached profile for a specific server.
// If the cache is stale (or missing), fetches fresh data from the remote
// before responding. Returns immediately from cache if fresh.

router.get(
  "/:domain",
  route(async ({ params, query, user, set, setStatus }) => {
    if (!user?.id) {
      setStatus(401);
      set("error", "Authentication required");
      return;
    }

    const domain = (params.domain || "")
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/\/.*$/, "")
      .trim();

    if (!domain) {
      setStatus(400);
      set("error", "Invalid domain");
      return;
    }

    const force = query.refresh === "true";

    const { server, error } = await fetchRemoteServerProfile(domain, { force });

    if (error && !server) {
      // Couldn't reach the server and nothing cached — 502 so the client
      // knows it's a remote problem, not a local 404.
      const existing = await FederatedServer.findOne({ domain }).lean();
      if (!existing) {
        setStatus(502);
        set("error", `Could not fetch profile for ${domain}: ${error}`);
        return;
      }
      // Stale cache is better than nothing — return it with a warning
      const { _id, __v, ...rest } = existing;
      set("stale", true);
      for (const [k, v] of Object.entries(rest)) set(k, v);
      return;
    }

    const { _id, __v, ...rest } = server;
    for (const [k, v] of Object.entries(rest)) set(k, v);
  })
);

export default router;
