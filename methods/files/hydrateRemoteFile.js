// Cache a remote file's metadata locally so feed enrichment can resolve it.
//
// Cross-server posts reference their media as `file:<id>@<remote-domain>`. The
// receiving server has no File record for those ids, so attachment enrichment
// (File.find over the local collection) dropped them entirely — every federated
// post with an image / audio / video showed no media. This fetches the origin's
// public `/files/:id/meta` and upserts a local File *shadow* whose `url` points
// back at the origin proxy, so the existing enrichment finds it and clients get
// a real mediaType (an audio player instead of nothing).
//
// PUBLIC files only. The origin's /meta and bytes are anonymous-fetchable just
// for `@public` files; restricted remote media needs cross-server signed URLs,
// which don't exist yet, so we skip those and leave the bare id (still dropped
// downstream, same as before — no regression).

import { File } from "#schema";
import kowloonId from "#methods/parse/kowloonId.js";
import isLocalDomain from "#methods/parse/isLocalDomain.js";

const FRESH_MS = 24 * 60 * 60 * 1000; // re-fetch a shadow's meta at most daily

// Returns the cached File doc (lean) or null. Never throws.
export async function hydrateRemoteFile(fileId, { fetcher = fetch } = {}) {
  if (typeof fileId !== "string" || !fileId.startsWith("file:")) return null;
  const parsed = kowloonId(fileId);
  const domain = parsed?.domain;
  if (!domain || isLocalDomain(domain)) return null; // local file — nothing to do

  const existing = await File.findOne({ id: fileId }).lean();
  if (
    existing?.updatedAt &&
    Date.now() - new Date(existing.updatedAt).getTime() < FRESH_MS
  ) {
    return existing;
  }

  let meta;
  try {
    const res = await fetcher(
      `https://${domain}/files/${encodeURIComponent(fileId)}/meta`,
      { headers: { accept: "application/json" } }
    );
    if (!res.ok) return existing || null;
    const body = await res.json();
    meta = body?.file || body?.item || body;
  } catch {
    return existing || null;
  }
  if (!meta || meta.to !== "@public") return existing || null; // public only

  const doc = {
    id: fileId,
    actorId: meta.actorId || `@${domain}`,
    name: meta.name || meta.originalFileName || "",
    summary: meta.summary || "",
    type: meta.type || "",
    mediaType: meta.mediaType || "",
    extension: meta.extension || "",
    to: "@public",
    // The origin's own proxy URL — the bytes live there, not here.
    url: meta.url || `https://${domain}/files/${encodeURIComponent(fileId)}`,
    server: `@${domain}`,
    originDomain: domain,
    size: meta.size,
    width: meta.width,
    height: meta.height,
  };
  try {
    return await File.findOneAndUpdate(
      { id: fileId },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch {
    return existing || null;
  }
}

// Hydrate many ids concurrently (deduped). Silent per-item failures.
export async function hydrateRemoteFiles(fileIds, opts = {}) {
  const unique = [...new Set((fileIds || []).filter(Boolean))];
  await Promise.all(unique.map((id) => hydrateRemoteFile(id, opts).catch(() => null)));
}
