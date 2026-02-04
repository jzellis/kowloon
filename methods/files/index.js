// methods/files/index.js
// Main exports for the file storage system

import StorageAdapter from './StorageAdapter.js';
import {
  getStorageAdapter,
  getAdapterByType,
  detectAdapterType,
  resetAdapter,
} from './StorageManager.js';
import { generateThumbnails, isImageMimeType } from './thumbnail.js';

export {
  StorageAdapter,
  getStorageAdapter,
  getAdapterByType,
  detectAdapterType,
  resetAdapter,
  generateThumbnails,
  isImageMimeType,
};

export default {
  StorageAdapter,
  getStorageAdapter,
  getAdapterByType,
  detectAdapterType,
  resetAdapter,
  generateThumbnails,
  isImageMimeType,
};
