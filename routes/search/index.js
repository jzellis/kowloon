// routes/search/index.js
// GET /search?q=term&type=Post&page=1

import express from "express";
import route from "../utils/route.js";
import { Post, Page, User, Group, Bookmark } from "#schema";
import { activityStreamsCollection } from "../utils/oc.js";
import { getSetting } from "#methods/settings/cache.js";

const router = express.Router({ mergeParams: true });

const SEARCHABLE = {
  Post: {
    model: Post,
    filter: { deletedAt: null, to: "@public" },
    select: "id type title summary body url actorId tags to createdAt",
  },
  Page: {
    model: Page,
    filter: { deletedAt: null, to: "@public" },
    select: "id type title slug summary url tags to createdAt",
  },
  User: {
    model: User,
    filter: { deletedAt: null, active: true, to: "@public" },
    select: "id type username profile url",
  },
  Group: {
    model: Group,
    filter: { deletedAt: null, to: "@public" },
    select: "id name description icon url memberCount to createdAt",
  },
  Bookmark: {
    model: Bookmark,
    filter: { deletedAt: null, to: "@public" },
    select: "id type title summary href target url tags to createdAt",
  },
};

router.get(
  "/",
  route(async ({ req, query, set, setStatus }) => {
    const q = (query.q || "").trim();
    if (!q) {
      setStatus(400);
      set("error", "Search query (q) is required");
      return;
    }

    // searchIn maps client-friendly names to SEARCHABLE keys
    const SEARCH_IN_MAP = {
      posts: "Post",
      pages: "Page",
      users: "User",
      groups: "Group",
      bookmarks: "Bookmark",
    };

    let requestedTypes;
    if (query.searchIn) {
      requestedTypes = query.searchIn
        .split(",")
        .map((s) => SEARCH_IN_MAP[s.trim()])
        .filter(Boolean);
      if (requestedTypes.length === 0) requestedTypes = Object.keys(SEARCHABLE);
    } else if (query.type) {
      requestedTypes = [query.type];
    } else {
      requestedTypes = Object.keys(SEARCHABLE);
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit, 10) || 20), 50);
    const skip = (page - 1) * limit;

    // Collect results from all requested types
    const allResults = [];

    await Promise.all(
      requestedTypes
        .filter((t) => SEARCHABLE[t])
        .map(async (typeName) => {
          const { model, filter, select } = SEARCHABLE[typeName];
          const textFilter = { ...filter, $text: { $search: q } };

          try {
            const docs = await model
              .find(textFilter, { score: { $meta: "textScore" } })
              .select(select)
              .sort({ score: { $meta: "textScore" } })
              .limit(limit * 2) // Over-fetch to merge across types
              .lean();

            for (const doc of docs) {
              allResults.push({
                ...doc,
                _searchType: typeName,
                _score: doc.score || 0,
              });
            }
          } catch {
            // Text index may not exist for this model; skip
          }
        })
    );

    // Sort by relevance, then paginate
    allResults.sort((a, b) => (b._score || 0) - (a._score || 0));
    const total = allResults.length;
    const paged = allResults.slice(skip, skip + limit).map((r) => {
      const { _score, score, ...rest } = r;
      return rest;
    });

    const domain = getSetting("domain");
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const base = `${protocol}://${domain}/search`;

    const collection = activityStreamsCollection({
      id: `${base}?q=${encodeURIComponent(q)}&page=${page}`,
      orderedItems: paged,
      totalItems: total,
      page,
      itemsPerPage: limit,
      baseUrl: `${base}?q=${encodeURIComponent(q)}`,
    });

    for (const [key, value] of Object.entries(collection)) {
      set(key, value);
    }
  })
);

export default router;
