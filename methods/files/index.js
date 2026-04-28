// methods/files/index.js

import StorageAdapter from './StorageAdapter.js';
import { getStorageAdapter, resetAdapter } from './StorageManager.js';
import { generateThumbnails, isImageMimeType } from './thumbnail.js';

export { StorageAdapter, getStorageAdapter, resetAdapter, generateThumbnails, isImageMimeType };

export default { StorageAdapter, getStorageAdapter, resetAdapter, generateThumbnails, isImageMimeType };
