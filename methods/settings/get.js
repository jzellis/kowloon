// This just retrieves the server settings from the cache and returns them as an object of key-value pairs.

import { getAllSettings } from "#methods/settings/cache.js";

export default async function () {
  return getAllSettings();
}
