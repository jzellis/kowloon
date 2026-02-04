// StorageAdapter.js
// Base class defining the interface for all storage adapters

export default class StorageAdapter {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Upload a file from a buffer
   * @param {Buffer} buffer - File contents
   * @param {Object} options - Upload options
   * @param {string} options.originalFileName - Original filename
   * @param {string} options.actorId - ID of the uploading actor
   * @param {string} [options.title] - Display title
   * @param {string} [options.summary] - Alt text/description
   * @param {string} [options.contentType] - MIME type (auto-detected if not provided)
   * @param {boolean} [options.generateThumbnail=false] - Generate thumbnails for images
   * @param {number[]} [options.thumbnailSizes=[200, 400]] - Thumbnail widths
   * @param {boolean} [options.isPublic=true] - Whether file should be publicly accessible
   * @returns {Promise<Object>} Upload result with key, url, thumbnails, metadata
   */
  async upload(buffer, options) {
    throw new Error('upload() must be implemented by adapter');
  }

  /**
   * Upload a file from a readable stream (for large files)
   * @param {ReadableStream} stream - File stream
   * @param {Object} options - Same as upload()
   * @param {number} [options.size] - File size if known (required by some adapters)
   * @returns {Promise<Object>} Upload result
   */
  async uploadStream(stream, options) {
    throw new Error('uploadStream() must be implemented by adapter');
  }

  /**
   * Delete a file by its storage key
   * @param {string} key - Storage key
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(key) {
    throw new Error('delete() must be implemented by adapter');
  }

  /**
   * Check if a file exists
   * @param {string} key - Storage key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('exists() must be implemented by adapter');
  }

  /**
   * Get the public URL for a file
   * @param {string} key - Storage key
   * @returns {string} Public URL
   */
  getPublicUrl(key) {
    throw new Error('getPublicUrl() must be implemented by adapter');
  }

  /**
   * Get a time-limited signed URL for private file access
   * @param {string} key - Storage key
   * @param {number} [expiresIn=3600] - Expiration time in seconds
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    throw new Error('getSignedUrl() must be implemented by adapter');
  }

  /**
   * Get file metadata
   * @param {string} key - Storage key
   * @returns {Promise<Object>} Metadata including size, contentType, etc.
   */
  async getMetadata(key) {
    throw new Error('getMetadata() must be implemented by adapter');
  }

  /**
   * Get a readable stream for a file
   * @param {string} key - Storage key
   * @returns {Promise<ReadableStream>}
   */
  async getStream(key) {
    throw new Error('getStream() must be implemented by adapter');
  }

  /**
   * Generate a unique storage key for a file
   * @param {string} originalFileName - Original filename
   * @param {string} [prefix] - Optional prefix/folder
   * @returns {string} Unique storage key
   */
  generateKey(originalFileName, prefix = '') {
    const ext = originalFileName.split('.').pop()?.toLowerCase() || '';
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const key = ext ? `${timestamp}-${random}.${ext}` : `${timestamp}-${random}`;
    return prefix ? `${prefix}/${key}` : key;
  }

  /**
   * Get the adapter name for logging/debugging
   * @returns {string}
   */
  get name() {
    return this.constructor.name;
  }
}
