/**
 * Ensures a Kowloon ID matches the expected object type.
 * Throws an error if the ID structure doesn't match.
 *
 * Users:           @username@domain
 * Other objects:   objecttype:uuid@domain
 *
 * @param {string} id        - Kowloon ID to check.
 * @param {string} expected  - Expected type (capitalized, e.g. "User", "Post").
 */
export default function assertTypeFromId(id, expected) {
  if (typeof id !== "string" || !id.includes("@")) {
    throw new Error(`Invalid Kowloon ID: ${id}`);
  }

  let actual;

  if (id.startsWith("@")) {
    actual = "User";
  } else {
    const typePart = id.split(":")[0]; // e.g., "post" from "post:uuid@domain"
    actual = typePart.charAt(0).toUpperCase() + typePart.slice(1);
  }

  if (actual !== expected) {
    throw new Error(`Expected ${expected} ID but got ${actual}: ${id}`);
  }
}
