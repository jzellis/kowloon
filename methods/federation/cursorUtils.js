// /methods/federation/cursorUtils.js
// Utilities for computing cursor hashes and managing Server cursor state

import crypto from "crypto";

/**
 * Compute SHA256 hash of a sorted array or string
 * @param {string|Array} data - Data to hash
 * @returns {string} Hex hash
 */
export function sha256(data) {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("sha256").update(str).digest("hex");
}

/**
 * Normalize filters for consistent hashing
 * @param {Object} filters - Filter object
 * @returns {Object} Normalized filters
 */
export function normalizeFilters(filters = {}) {
  const normalized = {};

  if (filters.objectTypes && Array.isArray(filters.objectTypes)) {
    normalized.objectTypes = filters.objectTypes.slice().sort();
  }

  if (filters.postTypes && Array.isArray(filters.postTypes)) {
    normalized.postTypes = filters.postTypes.slice().sort();
  }

  if (filters.bookmarkTypes && Array.isArray(filters.bookmarkTypes)) {
    normalized.bookmarkTypes = filters.bookmarkTypes.slice().sort();
  }

  return normalized;
}

/**
 * Compute filters hash
 * @param {Object} filters - Filter object
 * @returns {string} Hash of normalized filters
 */
export function computeFiltersHash(filters = {}) {
  const normalized = normalizeFilters(filters);
  return sha256(JSON.stringify(normalized));
}

/**
 * Compute actors set hash
 * @param {string[]} actors - Array of actor IDs
 * @param {string} filtersHash - Filters hash
 * @returns {string} Combined hash
 */
export function computeActorsSetHash(actors = [], filtersHash = "") {
  const sorted = actors.slice().sort();
  return `${sha256(JSON.stringify(sorted))}:${filtersHash}`;
}

/**
 * Compute audience set hash
 * @param {string[]} audience - Array of local user IDs
 * @param {string} filtersHash - Filters hash
 * @returns {string} Combined hash
 */
export function computeAudienceSetHash(audience = [], filtersHash = "") {
  const sorted = audience.slice().sort();
  return `${sha256(JSON.stringify(sorted))}:${filtersHash}`;
}

/**
 * Get or initialize cursor entry from Server cursors Map
 * @param {Map} cursorsMap - Server cursors Map (actors or audience)
 * @param {string} setHash - The set hash key
 * @param {Object} metadata - Metadata to store (actors or audience array)
 * @returns {Object} Cursor entry
 */
export function getOrInitCursor(cursorsMap, setHash, metadata = {}) {
  if (!cursorsMap) {
    cursorsMap = new Map();
  }

  let cursor = cursorsMap.get(setHash);

  if (!cursor) {
    cursor = {
      cursor: undefined,
      etag: undefined,
      filtersHash: metadata.filtersHash,
      actors: metadata.actors,
      audience: metadata.audience,
      updatedAt: new Date(),
      lastUsedAt: new Date(),
    };
  } else {
    cursor.lastUsedAt = new Date();
  }

  return cursor;
}
