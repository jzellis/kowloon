// #methods/Event/get.js
import getObjectById from "#methods/get/objectById.js";
import assertTypeFromId from "#methods/utils/assertTypeFromId.js";

/**
 * Get a single Event by Kowloon ID.
 *
 * @param {string} id - The Kowloon ID (e.g. "<type>:uuid@domain" or "@user@domain")
 * @param {object} [opts] - { select, lean=true, deleted=false }
 * @returns {Promise<object|null>}
 */
export default async function get(id, opts = {}) {
  assertTypeFromId(id, "Event");
  return getObjectById(id, opts);
}
