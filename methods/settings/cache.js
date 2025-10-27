// /methods/settings/cache.js
// In-memory cache for Settings to avoid repeated DB queries

import logger from "#methods/utils/logger.js";

/**
 * In-memory cache for settings.
 * Structure: { settingName: value }
 */
const cache = new Map();

/**
 * Load all settings from database into cache
 * @param {Model} SettingsModel - Mongoose Settings model
 */
export async function loadSettings(SettingsModel) {
  try {
    const settings = await SettingsModel.find({}).lean();

    cache.clear();
    for (const setting of settings) {
      if (setting.name) {
        cache.set(setting.name, setting.value);
      }
    }

    logger.info(`Settings cache loaded: ${cache.size} settings`);
    return cache.size;
  } catch (error) {
    logger.error("Failed to load settings cache", { error: error.message });
    throw error;
  }
}

/**
 * Get a setting value from cache
 * @param {string} name - Setting name
 * @param {*} defaultValue - Default value if setting not found
 * @returns {*} Setting value or default
 */
export function getSetting(name, defaultValue = null) {
  if (!cache.has(name)) {
    if (defaultValue !== null) {
      return defaultValue;
    }
    logger.warn(`Setting not found in cache: ${name}`);
    return null;
  }
  return cache.get(name);
}

/**
 * Get multiple settings at once
 * @param {string[]} names - Array of setting names
 * @returns {Object} Object with setting names as keys
 */
export function getSettings(...names) {
  const result = {};
  for (const name of names) {
    result[name] = getSetting(name);
  }
  return result;
}

/**
 * Set/update a setting in cache
 * @param {string} name - Setting name
 * @param {*} value - Setting value
 */
export function setSetting(name, value) {
  cache.set(name, value);
  logger.debug(`Setting updated in cache: ${name}`);
}

/**
 * Delete a setting from cache
 * @param {string} name - Setting name
 */
export function deleteSetting(name) {
  cache.delete(name);
  logger.debug(`Setting deleted from cache: ${name}`);
}

/**
 * Check if cache is loaded
 * @returns {boolean}
 */
export function isLoaded() {
  return cache.size > 0;
}

/**
 * Get cache size
 * @returns {number}
 */
export function getCacheSize() {
  return cache.size;
}

/**
 * Clear the entire cache
 */
export function clearCache() {
  cache.clear();
  logger.warn("Settings cache cleared");
}

/**
 * Get all cached settings as object
 * @returns {Object}
 */
export function getAllSettings() {
  return Object.fromEntries(cache);
}

export default {
  loadSettings,
  getSetting,
  getSettings,
  setSetting,
  deleteSetting,
  isLoaded,
  getCacheSize,
  clearCache,
  getAllSettings,
};
