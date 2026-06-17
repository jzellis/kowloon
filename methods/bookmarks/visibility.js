// methods/bookmarks/visibility.js
// Folder-aware visibility helpers for Bookmark and Folder records.
//
// Read-time inheritance rule: a bookmark or sub-folder is only visible if
// (a) its own `to` passes the viewer's visibility check AND (b) every
// ancestor folder up to root would also pass. This lets users keep a
// nominally @public bookmark inside a private folder without leaking it.

import { Bookmark } from "#schema";
import { canSeeObject } from "../visibility/helpers.js";

export const MAX_FOLDER_DEPTH = 5;

// Walk ancestor folders nearest-first. Capped at MAX_FOLDER_DEPTH so a
// cycle (which shouldn't exist, but...) can't run away.
export async function getAncestorFolders(parentFolderId) {
  if (!parentFolderId) return [];
  const ancestors = [];
  const seen = new Set();
  let cursor = parentFolderId;
  for (let i = 0; i < MAX_FOLDER_DEPTH; i++) {
    if (!cursor || seen.has(cursor)) break;
    seen.add(cursor);
    const folder = await Bookmark.findOne({
      id: cursor,
      type: "Folder",
      deletedAt: null,
    })
      .select("id type to parentFolder actorId")
      .lean();
    if (!folder) break;
    ancestors.push(folder);
    cursor = folder.parentFolder;
  }
  return ancestors;
}

// True if every folder from parentFolderId up to root is visible to the
// viewer. Trivially true when parentFolderId is falsy (root level).
// Returns false if any ancestor is missing/deleted/invisible.
export async function canSeeFolderChain(parentFolderId, ctx) {
  if (!parentFolderId) return true;
  const ancestors = await getAncestorFolders(parentFolderId);
  if (!ancestors.length) return false;
  for (const folder of ancestors) {
    if (!(await canSeeObject(folder, ctx))) return false;
  }
  return true;
}

// Per-doc visibility check used for single-bookmark fetches. Owner short-
// circuit mirrors canSeeObject's. For non-owners: bookmark's own `to` must
// pass AND every ancestor folder must be visible.
export async function canSeeBookmark(doc, ctx) {
  if (!doc) return false;
  if (ctx?.viewerId && doc.actorId === ctx.viewerId) return true;
  if (!(await canSeeObject(doc, ctx))) return false;
  return canSeeFolderChain(doc.parentFolder, ctx);
}

// Walk parentFolderId's ancestor chain and throw if placing a folder at
// that position would exceed MAX_FOLDER_DEPTH, cycle, or reference a
// missing parent. selfId is the moving/creating folder's own id (used to
// detect self-parenting); pass undefined for new folders.
export async function assertFolderDepthOk(parentFolderId, selfId) {
  if (!parentFolderId) return;
  const seen = new Set();
  let cursor = parentFolderId;
  let depth = 1; // the folder being placed
  while (cursor) {
    if (seen.has(cursor)) {
      throw new Error("Folder hierarchy contains a cycle");
    }
    if (selfId && cursor === selfId) {
      throw new Error("Folder cannot be its own ancestor");
    }
    seen.add(cursor);
    depth += 1;
    if (depth > MAX_FOLDER_DEPTH) {
      throw new Error(`Folder nesting limit (${MAX_FOLDER_DEPTH}) reached`);
    }
    const parent = await Bookmark.findOne({
      id: cursor,
      type: "Folder",
      deletedAt: null,
    })
      .select("id parentFolder")
      .lean();
    if (!parent) {
      throw new Error("parentFolder does not reference an existing Folder");
    }
    cursor = parent.parentFolder;
  }
}
