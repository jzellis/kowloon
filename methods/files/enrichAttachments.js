// Resolve post `image` + `attachments` references to client-usable shapes.
//
// Posts store images/attachments as "file:<id>@domain" ids or app file-proxy
// URLs. Clients need absolute URLs (featuredImage) and { url, mediaType, name }
// objects (attachments) with a mediaType so they can tell an image from audio.
// The feed endpoints (posts/collection, circles/posts) do this inline; this is
// the shared version so the endpoints that only ran feedItemToPost() — My Posts
// (users/posts) and group feeds — enrich too. Mutates `items` in place.
//
// Restricted (non-public) files get a short-lived signed URL; every URL carries
// a ?v=updatedAt cache-buster so a corrected image (e.g. an orientation fix)
// isn't pinned in client caches.

import { File } from "#schema";
import { buildFileUrl, isPublicVisibility } from "#methods/files/signedUrl.js";
import { fileIdFromValue } from "#methods/files/fileRef.js";
import { getSetting } from "#methods/settings/cache.js";

export async function enrichAttachments(items, { protocol = "https" } = {}) {
  if (!Array.isArray(items) || items.length === 0) return items;
  const domain = getSetting("domain");

  const fileIds = new Set();
  const restrictedIds = new Set();
  for (const item of items) {
    const restricted = !isPublicVisibility(item?.to);
    const add = (v) => {
      const fid = fileIdFromValue(v);
      if (!fid) return;
      fileIds.add(fid);
      if (restricted) restrictedIds.add(fid);
    };
    add(item?.image);
    for (const a of item?.attachments ?? []) add(a);
  }

  const map = new Map();
  if (fileIds.size > 0) {
    const files = await File.find({ id: { $in: [...fileIds] } })
      .select("id mediaType name summary updatedAt")
      .lean();
    for (const f of files) {
      map.set(f.id, {
        url: buildFileUrl({
          fileId: f.id,
          domain,
          protocol,
          restricted: restrictedIds.has(f.id),
          version: f.updatedAt ? new Date(f.updatedAt).getTime() : undefined,
        }),
        mediaType: f.mediaType ?? "",
        name: f.name ?? f.summary ?? "",
      });
    }
  }

  for (const item of items) {
    const imgFid = fileIdFromValue(item?.image);
    if (imgFid) item.featuredImage = map.get(imgFid)?.url ?? null;
    else if (typeof item?.image === "string" && item.image.startsWith("http"))
      item.featuredImage = item.image;

    if (item?.attachments?.length) {
      item.attachments = item.attachments
        .map((v) => {
          const entry = map.get(fileIdFromValue(v));
          if (entry) return entry;
          if (typeof v === "string" && v.startsWith("http"))
            return { url: v, mediaType: "", name: "" };
          return null;
        })
        .filter(Boolean);
    }
  }

  return items;
}
