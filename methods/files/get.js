// #methods/files/get.js
import getObjectById from "#methods/get/objectById.js";
import assertTypeFromId from "#methods/utils/assertTypeFromId.js";

/**
 * Get a single File by Kowloon ID.
 *
 * @param {string} id - The Kowloon ID (e.g. "file:uuid@domain")
 * @param {object} [opts] - { select, lean=true, deleted=false }
 * @returns {Promise<object|null>}
 */
export default async function get(id, opts = {}) {
  assertTypeFromId(id, "file");
  return getObjectById(id, opts);
}
