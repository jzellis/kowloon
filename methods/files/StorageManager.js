// StorageManager.js
// Factory for storage adapters with auto-detection

import LocalAdapter from './adapters/LocalAdapter.js';

// Lazy-loaded adapters to avoid requiring unused dependencies
let S3Adapter = null;
let AzureAdapter = null;
let GCSAdapter = null;

// Singleton instance
let adapterInstance = null;
let detectedType = null;

/**
 * Detect which storage adapter to use based on environment variables
 * Priority: S3 > Azure > GCS > Local
 * @returns {string} Adapter type: 'S3', 'Azure', 'GCS', or 'Local'
 */
export function detectAdapterType() {
  if (detectedType) return detectedType;

  if (process.env.S3_BUCKET) {
    detectedType = 'S3';
  } else if (process.env.AZURE_STORAGE_CONTAINER) {
    detectedType = 'Azure';
  } else if (process.env.GCS_BUCKET) {
    detectedType = 'GCS';
  } else {
    detectedType = 'Local';
  }

  return detectedType;
}

/**
 * Get configuration for the detected adapter type
 * @param {string} type - Adapter type
 * @returns {Object} Configuration object
 */
function getConfigForType(type) {
  switch (type) {
    case 'S3':
      return {
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT, // For MinIO
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        publicUrl: process.env.S3_PUBLIC_URL,
        forcePathStyle: !!process.env.S3_ENDPOINT, // Required for MinIO
      };

    case 'Azure':
      return {
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
        container: process.env.AZURE_STORAGE_CONTAINER,
        cdnUrl: process.env.AZURE_CDN_URL,
      };

    case 'GCS':
      return {
        bucket: process.env.GCS_BUCKET,
        projectId: process.env.GCS_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        cdnUrl: process.env.GCS_CDN_URL,
      };

    case 'Local':
    default:
      return {
        storagePath: process.env.LOCAL_STORAGE_PATH || './uploads',
        urlPrefix: process.env.LOCAL_STORAGE_URL || '/files',
      };
  }
}

/**
 * Lazy-load an adapter module
 * @param {string} type - Adapter type
 * @returns {Promise<typeof StorageAdapter>}
 */
async function loadAdapter(type) {
  switch (type) {
    case 'S3':
      if (!S3Adapter) {
        const module = await import('./adapters/S3Adapter.js');
        S3Adapter = module.default;
      }
      return S3Adapter;

    case 'Azure':
      if (!AzureAdapter) {
        const module = await import('./adapters/AzureAdapter.js');
        AzureAdapter = module.default;
      }
      return AzureAdapter;

    case 'GCS':
      if (!GCSAdapter) {
        const module = await import('./adapters/GCSAdapter.js');
        GCSAdapter = module.default;
      }
      return GCSAdapter;

    case 'Local':
    default:
      return LocalAdapter;
  }
}

/**
 * Get the storage adapter instance (singleton)
 * Auto-detects and instantiates the appropriate adapter
 * @returns {Promise<StorageAdapter>}
 */
export async function getStorageAdapter() {
  if (adapterInstance) return adapterInstance;

  const type = detectAdapterType();
  const config = getConfigForType(type);
  const AdapterClass = await loadAdapter(type);

  adapterInstance = new AdapterClass(config);
  console.log(`[Storage] Using ${type} adapter`);

  return adapterInstance;
}

/**
 * Get a specific adapter by type (for testing or explicit selection)
 * @param {string} type - Adapter type: 'S3', 'Azure', 'GCS', 'Local'
 * @param {Object} [config] - Override config (uses env vars if not provided)
 * @returns {Promise<StorageAdapter>}
 */
export async function getAdapterByType(type, config = null) {
  const AdapterClass = await loadAdapter(type);
  const finalConfig = config || getConfigForType(type);
  return new AdapterClass(finalConfig);
}

/**
 * Reset the singleton (mainly for testing)
 */
export function resetAdapter() {
  adapterInstance = null;
  detectedType = null;
}

export default {
  getStorageAdapter,
  getAdapterByType,
  detectAdapterType,
  resetAdapter,
};
