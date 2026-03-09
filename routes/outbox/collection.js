// routes/outbox/collection.js
// GET /outbox
//
// Three modes:
//   Batch-pull S2S (from= AND to= present): Remote server fetches content for specific local users.
//     Returns items array + recipients array mapping each item to the to-users who should see it.
//     Used by pullFromRemote() on remote servers.
//   Legacy S2S pull (from= only): Remote server fetches public content by local authors.
//     Returns FeedItems. Kept for backwards compatibility.
//   Public firehose (no from): Human-readable ActivityStreams activity feed (unauthenticated).

import route from "../utils/route.js";
import { Activity, Circle, FeedItems, Post } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

// A bare-server from entry looks like "@kwln2.local" (one @ at position 0, no second @)
// A user from entry looks like "@alice@kwln2.local" (two @s)
function isServerEntry(id) {
  return id.startsWith("@") && !id.slice(1).includes("@");
}

export default route(
  async ({ req, query, set }) => {
    const domain = getSetting("domain");
    const base = `https://${domain}/outbox`;
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 100);

    // -------------------------------------------------------------------------
    // Batch-pull S2S mode: ?from= AND ?to= both present
    // -------------------------------------------------------------------------
    if (query.from && query.to) {
      const froms = Array.isArray(query.from) ? query.from : [query.from];
      const tos = Array.isArray(query.to) ? query.to : [query.to];
      const since = query.since ? new Date(query.since) : null;
      const sinceFilter = since ? { publishedAt: { $gte: since } } : {};

      const serverFroms = froms.filter(isServerEntry);
      const userFroms = froms.filter((f) => !isServerEntry(f));

      const baseFilter = {
        tombstoned: { $ne: true },
        objectType: { $nin: ["Group", "Circle"] },
        ...sinceFilter,
      };

      // Find circles owned by userFrom users that contain any to users.
      // This gives us two things:
      //   - which to users "follow" each from user (are in any of their circles)
      //   - which to users are in each specific circle (for circle-addressed posts)
      const circles =
        userFroms.length > 0
          ? await Circle.find({
              actorId: { $in: userFroms },
              "members.id": { $in: tos },
            }).lean()
          : [];

      // circleMembers: { circleId → Set of to-user ids }
      const circleMembers = {};

      for (const circle of circles) {
        for (const member of circle.members) {
          if (tos.includes(member.id)) {
            if (!circleMembers[circle.id]) circleMembers[circle.id] = new Set();
            circleMembers[circle.id].add(member.id);
          }
        }
      }

      // 1. Public posts from user from entries
      //    Recipients = to users who are in any of that author's circles
      const userPublicItems =
        userFroms.length > 0
          ? await FeedItems.find({
              ...baseFilter,
              actorId: { $in: userFroms },
              to: "public",
            })
              .sort({ publishedAt: -1 })
              .limit(limit)
              .lean()
          : [];

      // 2. Public posts from bare-server from entries
      //    Recipients = all to users (kwln1 is responsible for only including
      //    users who have the server entry in one of their circles)
      const serverPublicItems =
        serverFroms.length > 0
          ? await FeedItems.find({
              ...baseFilter,
              server: { $in: serverFroms },
              to: "public",
            })
              .sort({ publishedAt: -1 })
              .limit(limit)
              .lean()
          : [];

      // 3. Circle-addressed posts from user from entries
      //    FeedItems stores to:"audience" for these — must look up Post.to for the circle ID
      const circleIds = Object.keys(circleMembers);
      let circleItems = [];
      const postToCircleMap = {}; // { postId → circleId }

      if (circleIds.length > 0) {
        const posts = await Post.find({
          actorId: { $in: userFroms },
          to: { $in: circleIds },
          deletedAt: null,
          ...(since ? { createdAt: { $gte: since } } : {}),
        })
          .select("id to")
          .lean();

        for (const p of posts) postToCircleMap[p.id] = p.to;

        const postIds = Object.keys(postToCircleMap);
        if (postIds.length > 0) {
          circleItems = await FeedItems.find({
            id: { $in: postIds },
            tombstoned: { $ne: true },
          }).lean();
        }
      }

      // Build deduplicated item map: itemId → { item, recipients: Set }
      const itemMap = new Map();

      const addToMap = (item, recipientIterable) => {
        if (itemMap.has(item.id)) {
          for (const r of recipientIterable) {
            itemMap.get(item.id).recipients.add(r);
          }
        } else {
          itemMap.set(item.id, { item, recipients: new Set(recipientIterable) });
        }
      };

      for (const item of userPublicItems) {
        addToMap(item, tos);
      }

      for (const item of serverPublicItems) {
        addToMap(item, tos);
      }

      for (const item of circleItems) {
        const circleId = postToCircleMap[item.id];
        const members = circleMembers[circleId];
        if (members?.size > 0) addToMap(item, members);
      }

      // Sort newest first
      const sorted = [...itemMap.values()].sort(
        (a, b) => new Date(b.item.publishedAt) - new Date(a.item.publishedAt)
      );

      const items = sorted.map(({ item }) => item);
      const recipients = sorted.map(({ item, recipients }) => ({
        itemId: item.id,
        to: [...recipients],
      }));

      set("@context", "https://www.w3.org/ns/activitystreams");
      set("type", "OrderedCollection");
      set("id", base);
      set("totalItems", items.length);
      set("items", items);
      set("recipients", recipients);
      if (items.length > 0) {
        set("next", new Date(items[items.length - 1].publishedAt).toISOString());
      }
      return;
    }

    // -------------------------------------------------------------------------
    // Legacy S2S pull mode: ?from= present, no ?to=
    // -------------------------------------------------------------------------
    if (query.from) {
      const authors = Array.isArray(query.from) ? query.from : [query.from];
      const types = query.type
        ? Array.isArray(query.type)
          ? query.type
          : [query.type]
        : [];

      const itemsQuery = {
        actorId: { $in: authors },
        to: "public",
        tombstoned: { $ne: true },
        objectType: { $nin: ["Group", "Circle"] },
      };

      if (query.since) {
        itemsQuery.publishedAt = { $gte: new Date(query.since) };
      }
      if (types.length > 0) {
        itemsQuery.type = { $in: types };
      }

      const items = await FeedItems.find(itemsQuery)
        .sort({ publishedAt: -1 })
        .limit(limit)
        .lean();

      set("@context", "https://www.w3.org/ns/activitystreams");
      set("type", "OrderedCollection");
      set("id", base);
      set("totalItems", items.length);
      set("orderedItems", items);
      if (items.length > 0) {
        set("next", new Date(items[items.length - 1].publishedAt).toISOString());
      }
      return;
    }

    // -------------------------------------------------------------------------
    // Public firehose mode (no from)
    // -------------------------------------------------------------------------
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {
      deletedAt: null,
      $or: [{ to: "@public" }, { "object.to": "@public" }],
    };

    if (query.since) {
      filter.createdAt = { $gte: new Date(query.since) };
    }
    if (query.type) {
      filter.type = query.type;
    }

    const [docs, total] = await Promise.all([
      Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Activity.countDocuments(filter),
    ]);

    const collection = activityStreamsCollection({
      id: `${base}?page=${page}`,
      orderedItems: docs,
      totalItems: total,
      page,
      itemsPerPage: limit,
      baseUrl: base,
    });

    for (const [key, value] of Object.entries(collection)) {
      set(key, value);
    }
  },
  { allowUnauth: true }
);
