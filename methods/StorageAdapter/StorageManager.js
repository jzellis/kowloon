import LocalStorageAdapter from "./adapters/local.js";
import S3StorageAdapter from "./adapters/s3.js";
import AzureStorageAdapter from "./adapters/azure.js";
import GCSStorageAdapter from "./adapters/gcs.js";

let adapter;

export function getStorageAdapter() {
  if (adapter) return adapter;

  const backend = process.env.STORAGE_BACKEND || "local";

  switch (backend) {
    case "s3":
      adapter = new S3StorageAdapter();
      break;
    case "azure":
      adapter = new AzureStorageAdapter();
      break;
    case "gcs":
      adapter = new GCSStorageAdapter();
      break;
    default:
      adapter = new LocalStorageAdapter();
  }

  return adapter;
}
