// StorageManager.js — S3-compatible storage only (AWS S3, MinIO, Backblaze B2, etc.)

import S3Adapter from './adapters/S3Adapter.js';

let adapterInstance = null;

function getConfig() {
  return {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    publicUrl: process.env.S3_PUBLIC_URL,
    forcePathStyle: !!process.env.S3_ENDPOINT, // required for MinIO
  };
}

export async function getStorageAdapter() {
  if (adapterInstance) return adapterInstance;
  adapterInstance = new S3Adapter(getConfig());
  console.log('[Storage] Using S3 adapter');
  return adapterInstance;
}

export function resetAdapter() {
  adapterInstance = null;
}

export default { getStorageAdapter, resetAdapter };
