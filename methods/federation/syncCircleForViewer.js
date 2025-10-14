import log from "#methods/utils/logger.js";

export default async function syncCircleForViewer(
  viewerId,
  circleId,
  opts = {}
) {
  const t0 = Date.now();
  log.info("syncCircleForViewer start", { viewerId, circleId });

  const limitPerDomain = Math.max(1, Number(opts.limitPerDomain || 200));
  const parallel = Math.max(1, Number(opts.parallel || 6));

  const circle = await Circle.findOne({ id: circleId }).lean();
  if (!circle)
    throw new Error(`syncCircleForViewer: circle not found: ${circleId}`);
  const members = Array.isArray(circle.members) ? circle.members : [];

  const byDomain = partitionMembersByDomain(members);
  const domains = Object.keys(byDomain);

  log.debug("Domains partitioned", { domains });

  let active = 0,
    idx = 0,
    totalItems = 0;
  const errors = [];

  await new Promise((resolve) => {
    const tick = async () => {
      if (idx >= domains.length && active === 0) return resolve();
      while (active < parallel && idx < domains.length) {
        const domain = domains[idx++];
        active++;
        const start = Date.now();
        log.debug("→ pull start", { domain, viewerId, circleId });
        handleDomain(domain).then(
          ({ items }) => {
            const dur = Date.now() - start;
            log.info("✅ pull complete", { domain, items, durationMs: dur });
            totalItems += items;
            active--;
            tick();
          },
          (err) => {
            log.warn("❌ pull failed", { domain, error: err.message });
            errors.push({ domain, error: String(err?.message || err) });
            active--;
            tick();
          }
        );
      }
    };
    tick();
  });

  const ms = Date.now() - t0;
  log.info("syncCircleForViewer complete", {
    viewerId,
    circleId,
    domains: domains.length,
    totalItems,
    durationMs: ms,
    errors: errors.length,
  });

  return { domains: domains.length, items: totalItems, errors };

  // ---- Domain runner (unchanged logic) ----
  async function handleDomain(remoteDomain) {
    const domainMembers = byDomain[remoteDomain];
    const enriched = await Promise.all(
      domainMembers.map(async (m) => ({
        id: m.id,
        visibleTo: await visibleToSetsForMember(m.id, circleId),
      }))
    );

    const cursorDoc = await FederationCursor.findOne({
      viewerId,
      circleId,
      remoteDomain,
    }).lean();
    const since = opts.since ? String(opts.since) : cursorDoc?.since || null;

    const body = {
      viewer: viewerId,
      members: enriched,
      since,
      limit: limitPerDomain,
    };
    const url = `https://${remoteDomain}/federation/pull`;
    const res = await signedJsonPost(url, body);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`pull ${remoteDomain} failed: ${res.status} ${txt}`);
    }

    const payload = await res.json();
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];

    if (items.length) {
      const ops = items.map((o) => {
        const objectId = String(o.id);
        const objectType = String(o.type || o.objectType || "Post");
        const createdAt = new Date(o.createdAt || o.published || Date.now());
        const scope = (o.visibility || o.scope || "public").toLowerCase();
        const originDomain = domainFromId(o.actorId) || remoteDomain;
        const snapshot = {
          id: objectId,
          actorId: o.actorId,
          title: o.title,
          body: o.body,
          media: o.media,
          visibility: scope,
          summary: o.summary,
        };
        return {
          updateOne: {
            filter: { userId: viewerId, objectId },
            update: {
              $setOnInsert: {
                userId: viewerId,
                objectType,
                objectId,
                createdAt,
                reason: "circle",
                scope,
                localCircleId: circleId,
                snapshot,
                originDomain,
                fetchedAt: new Date(),
              },
            },
            upsert: true,
          },
        };
      });
      await TimelineEntry.bulkWrite(ops, { ordered: false });
    }

    const newSince = payload?.next || items.at(-1)?.createdAt || since;
    if (newSince) {
      await FederationCursor.findOneAndUpdate(
        { viewerId, circleId, remoteDomain },
        { $set: { since: String(newSince) } },
        { upsert: true }
      );
    }

    return { items: items.length };
  }
}

// ---------------- helpers ----------------

function partitionMembersByDomain(members) {
  const map = {};
  for (const m of members) {
    const id = m?.id || m;
    const dom = domainFromId(id);
    if (!dom) continue;
    (map[dom] ||= []).push({ id: typeof m === "string" ? m : m.id });
  }
  return map;
}

function domainFromId(id) {
  if (typeof id !== "string") return null;
  const at = id.lastIndexOf("@");
  if (at === -1) return null;
  return id.slice(at + 1).trim() || null;
}

async function visibleToSetsForMember(memberId, primaryCircleId) {
  const ids = new Set([primaryCircleId]);
  const extra = await Circle.find(
    {
      "members.id": memberId,
      name: { $in: ["members", "attending", "interested"] },
    },
    { id: 1 }
  ).lean();
  for (const c of extra) if (c?.id) ids.add(c.id);
  ids.add(memberId);
  return Array.from(ids);
}

async function signedJsonPost(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
