// /methods/federation/handlePull.js
// Minimal handler for POST /federation/pull
// Given: { viewer, members:[{id, visibleTo:[]}, ...], since?, limit? }
// Returns: { items: [...], next? }

import { Post, Reply, Page, Event, Group } from "#schema";
import log from "#methods/utils/logger.js";
// Add/remove models as you like. Each must have at least: id, type or objectType, actorId, createdAt, to, cc.
const CANDIDATE_MODELS = [
  { name: "Post", Model: Post },
  { name: "Reply", Model: Reply },
  { name: "Page", Model: Page },
  // Event and Group are included because an Event/Group might publish updates/announcements
  { name: "Event", Model: Event },
  { name: "Group", Model: Group },
];

export default async function handlePull({
  viewer,
  members,
  since,
  limit = 200,
}) {
  log.info(`federation.pull ← request`, {
    viewer,
    members: members?.length,
    since,
    limit,
  });

  try {
    // Basic sanity checks
    if (!viewer || !Array.isArray(members) || members.length === 0) {
      return { error: "Invalid payload: require { viewer, members[] }" };
    }
    // Enforce reasonable cap
    limit = Math.max(1, Math.min(1000, Number(limit) || 200));

    // Build the set of addressing IDs we will honor locally
    // We *only* accept opaque IDs we know about: local circle ids, local group/event member circles, and remote user ids.
    // NOTE: For v1 we trust visibleTo as-is; if you want stricter checks, resolve each id locally and drop unknowns.
    const allowIds = new Set();
    for (const m of members) {
      if (typeof m?.id === "string") allowIds.add(m.id);
      const vs = Array.isArray(m?.visibleTo) ? m.visibleTo : [];
      for (const id of vs)
        if (typeof id === "string" && id.trim()) allowIds.add(id.trim());
    }
    log.debug(`allowlist built`, { count: allowIds.size });
    if (log.levels[log.level] <= log.levels.verbose) {
      log.verbose("allowlist sample", {
        sample: Array.from(allowIds).slice(0, 10),
        total: allowIds.size,
      });
    }
    // Since cursor: accept ISO string or numeric timestamp; store as Date filter if valid
    const sinceDate = parseSince(since);

    // Build the common query: (to ∈ allowIds OR cc ∈ allowIds) AND createdAt > since
    // Avoid regex; these are exact ids.
    const addressingClause = [
      { to: { $in: [...allowIds] } },
      { cc: { $in: [...allowIds] } },
    ];
    const baseQuery = {
      $or: addressingClause,
      ...(sinceDate ? { createdAt: { $gt: sinceDate } } : {}),
    };

    // Pull from all candidate models, collect, then sort & slice
    let rows = [];
    for (const { Model, name } of CANDIDATE_MODELS) {
      const docs = await Model.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      if (docs.length)
        log.debug("model hits", { model: name, count: docs.length });
      // Normalize to compact item shape
      for (const d of docs) {
        rows.push(toItem(d, name));
      }
    }

    // Global sort newest→oldest, unique by id, take up to limit
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const seen = new Set();
    const items = [];
    for (const it of rows) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      items.push(it);
      if (items.length >= limit) break;
    }

    // Next cursor: oldest item we returned
    const next = items.length ? items[items.length - 1].createdAt : undefined;
    const durationMs = Date.now() - t0;
    log.info("federation.pull → response", {
      items: items.length,
      next,
      durationMs,
    });
    return { items, ...(next ? { next } : {}) };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

/* ---------------- helpers ---------------- */

function parseSince(since) {
  if (!since) return null;
  if (since instanceof Date) return since;
  if (typeof since === "number") return new Date(since);
  if (typeof since === "string") {
    const dt = new Date(since);
    if (!isNaN(dt.getTime())) return dt;
  }
  return null;
}

// Map a DB doc into the compact federation item we promised
function toItem(d, fallbackType) {
  const type = d?.type || d?.objectType || fallbackType || "Post";
  // Keep these minimal -- the remote will store its own snapshot for display
  return {
    id: d.id, // e.g. "post:<uuid>@local.domain"
    type,
    actorId: d.actorId, // typical actor field
    createdAt:
      d.createdAt || d.published || d.updatedAt || new Date().toISOString(),
    visibility: inferVisibility(d), // "public" | "server" | "circle"
    // lightweight snapshot
    title: d.title,
    body: d.body,
    media: d.media,
    summary: d.summary,
  };
}

function inferVisibility(d) {
  // Very lightweight inference. If you encode visibility explicitly on your docs, use that instead.
  if (typeof d?.visibility === "string") return d.visibility;
  // If addressed to a circle only, we'll call it "circle"; else default to "public".
  const to = d?.to || [];
  if (Array.isArray(to) && to.length) return "circle";
  return "public";
}
