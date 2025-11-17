import S3StorageAdapter from "./adapters/s3.js";

let adapter;

export function getStorageAdapter() {
  if (!adapter) {
    adapter = new S3StorageAdapter();
  }
  return adapter;
}
