// This just retrieves the server settings from the cache and returns them as an object of key-value pairs.

import { getSetting } from "#methods/settings/cache.js";

export default async function () {
  return getSetting("adminUsers");
}
