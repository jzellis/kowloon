// routes/recommendations/index.js
// GET /recommendations — the curated Discover surface.
//
// Returns active RecommendationSections in order, each resolved to its visible
// items. Viewer-aware: authenticated LOCAL users see public + server-tier
// items; everyone else (logged-out, remote users, other servers) sees public
// only — the same tiered gate used by /circles and /posts.
//
// Recommendations store only a reference, so each target is resolved live here
// and dropped if it was deleted or its visibility narrowed after being curated.

import express from "express";
import route from "../utils/route.js";
import {
  Recommendation,
  RecommendationSection,
  Post,
  Circle,
  Group,
  Bookmark,
  Page,
} from "#schema";
import { getSetting } from "#methods/settings/cache.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";
import kowloonId from "#methods/parse/kowloonId.js";
import { buildFileUrl } from "#methods/files/signedUrl.js";

const router = express.Router({ mergeParams: true });

// Coarse visibility tier from an object's `to` field.
function tierOf(to, domain) {
  if (to === "@public" || to === "public") return "public";
  if (to === `@${domain}` || to === "@server" || to === "server") return "server";
  return "private"; // circle-/user-addressed, audience, empty — never surfaced
}

function visibleToViewer(tier, isLocal) {
  if (tier === "public") return true;
  if (tier === "server") return !!isLocal;
  return false;
}

function resolveImg(img, domain, protocol, restricted) {
  if (!img || typeof img !== "string") return null;
  if (img.startsWith("file:"))
    return buildFileUrl({ fileId: img, domain, protocol, restricted });
  return img; // already an http(s) URL
}

// Shape a resolved target into a compact card the client can render by refType.
function shapeCard(refType, doc, note, { domain, protocol, restricted }) {
  const base = { id: doc.id, refType, to: doc.to, note: note || null };
  switch (refType) {
    case "Post":
      return {
        ...base,
        type: doc.type,
        title: doc.title || null,
        summary: doc.summary || null,
        featuredImage: resolveImg(doc.image, domain, protocol, restricted),
        actor: doc.actor
          ? { id: doc.actorId, name: doc.actor.name, icon: doc.actor.icon }
          : { id: doc.actorId },
        url: doc.url || null,
      };
    case "Circle":
      return {
        ...base,
        name: doc.name || null,
        summary: doc.summary || null,
        icon: resolveImg(doc.icon, domain, protocol, restricted),
        memberCount: doc.memberCount ?? null,
        actorId: doc.actorId || null,
      };
    case "Group":
      return {
        ...base,
        name: doc.name || null,
        description: doc.description || null,
        icon: resolveImg(doc.icon, domain, protocol, restricted),
        image: resolveImg(doc.image, domain, protocol, restricted),
        memberCount: doc.memberCount ?? null,
        rsvpPolicy: doc.rsvpPolicy || null,
      };
    case "Bookmark":
      return {
        ...base,
        title: doc.title || null,
        summary: doc.summary || null,
        image: resolveImg(doc.image, domain, protocol, restricted),
        href: doc.href || null,
      };
    case "Page":
      return {
        ...base,
        title: doc.title || null,
        summary: doc.summary || null,
        featuredImage: resolveImg(doc.image, domain, protocol, restricted),
        url: doc.url || null,
      };
    default:
      return null;
  }
}

const MODELS = { Post, Circle, Group, Bookmark, Page };

router.get(
  "/",
  route(
    async ({ req, user, set }) => {
      const domain = getSetting("domain");
      const protocol = req.headers["x-forwarded-proto"] || "https";

      let isLocal = false;
      if (user?.id) {
        const parsed = kowloonId(user.id);
        isLocal = !!(parsed.domain && isLocalDomain(parsed.domain));
      }

      // Active sections visible to this viewer, in order.
      const sections = await RecommendationSection.find({
        deletedAt: null,
        active: true,
      })
        .sort({ order: 1, createdAt: 1 })
        .lean();

      const visibleSections = sections.filter((s) =>
        visibleToViewer(tierOf(s.to, domain), isLocal)
      );
      if (visibleSections.length === 0) {
        set("@context", "https://www.w3.org/ns/activitystreams");
        set("type", "Collection");
        set("sections", []);
        return;
      }

      const sectionIds = visibleSections.map((s) => s.id);
      const recs = await Recommendation.find({
        section: { $in: sectionIds },
        deletedAt: null,
        active: true,
      })
        .sort({ order: 1, createdAt: 1 })
        .lean();

      // Batch-resolve targets by type (one query per model).
      const byType = new Map(); // refType -> Set(ref)
      for (const r of recs) {
        if (!r.refType || !MODELS[r.refType]) continue;
        if (!byType.has(r.refType)) byType.set(r.refType, new Set());
        byType.get(r.refType).add(r.ref);
      }

      const resolved = new Map(); // ref -> raw doc
      await Promise.all(
        [...byType.entries()].map(async ([refType, refs]) => {
          const docs = await MODELS[refType]
            .find({ id: { $in: [...refs] }, deletedAt: null })
            .lean();
          for (const d of docs) resolved.set(d.id, d);
        })
      );

      // Assemble each section's visible items.
      const out = [];
      for (const s of visibleSections) {
        const items = [];
        for (const r of recs) {
          if (r.section !== s.id) continue;
          const doc = resolved.get(r.ref);
          if (!doc) continue; // deleted or never resolvable
          const tier = tierOf(doc.to, domain);
          if (!visibleToViewer(tier, isLocal)) continue; // narrowed since curated
          const card = shapeCard(r.refType, doc, r.note, {
            domain,
            protocol,
            restricted: tier !== "public",
          });
          if (card) items.push(card);
        }
        if (items.length === 0) continue; // hide empty shelves
        out.push({
          id: s.id,
          name: s.name,
          slug: s.slug,
          summary: s.summary || null,
          order: s.order,
          items,
        });
      }

      set("@context", "https://www.w3.org/ns/activitystreams");
      set("type", "Collection");
      set("sections", out);
    },
    { allowUnauth: true }
  )
);

export default router;
