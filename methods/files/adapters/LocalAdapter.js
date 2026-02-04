// LocalAdapter.js
// Local filesystem storage adapter for development and testing

import { promises as fs } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import StorageAdapter from '../StorageAdapter.js';
import { generateThumbnails, isImageMimeType, getImageMetadata } from '../thumbnail.js';
import mime from 'mime-types';

export default class LocalAdapter extends StorageAdapter {
  constructor(config = {}) {
    super(config);
    this.storagePath = path.resolve(config.storagePath || './uploads');
    this.urlPrefix = config.urlPrefix || '/files';
    this.initialized = false;
  }

  async ensureDirectory(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }

  async init() {
    if (this.initialized) return;
    await this.ensureDirectory(this.storagePath);
    await this.ensureDirectory(path.join(this.storagePath, 'thumbnails'));
    this.initialized = true;
  }

  getFilePath(key) {
    return path.join(this.storagePath, key);
  }

  async upload(buffer, options) {
    await this.init();

    const {
      originalFileName,
      actorId,
      title,
      summary,
      contentType,
      generateThumbnail = false,
      thumbnailSizes = [200, 400],
      isPublic = true,
    } = options;

    const key = this.generateKey(originalFileName);
    const filePath = this.getFilePath(key);
    const mimeType = contentType || mime.lookup(originalFileName) || 'application/octet-stream';

    // Write main file
    await fs.writeFile(filePath, buffer);

    const result = {
      key,
      url: isPublic ? this.getPublicUrl(key) : null,
      thumbnails: null,
      metadata: {
        size: buffer.length,
        contentType: mimeType,
        originalFileName,
        actorId,
        title,
        summary,
      },
    };

    // Generate thumbnails for images if requested
    if (generateThumbnail && isImageMimeType(mimeType)) {
      try {
        const imageMetadata = await getImageMetadata(buffer);
        result.metadata.width = imageMetadata.width;
        result.metadata.height = imageMetadata.height;

        const thumbnails = await generateThumbnails(buffer, thumbnailSizes);
        result.thumbnails = {};

        for (const [size, thumbBuffer] of Object.entries(thumbnails)) {
          const thumbKey = `thumbnails/${key.replace(/\.[^.]+$/, '')}_${size}.webp`;
          const thumbPath = this.getFilePath(thumbKey);
          await this.ensureDirectory(path.dirname(thumbPath));
          await fs.writeFile(thumbPath, thumbBuffer);
          result.thumbnails[size] = this.getPublicUrl(thumbKey);
        }
      } catch (err) {
        console.error('[LocalAdapter] Thumbnail generation failed:', err.message);
      }
    }

    return result;
  }

  async uploadStream(stream, options) {
    await this.init();

    const {
      originalFileName,
      actorId,
      title,
      summary,
      contentType,
      isPublic = true,
    } = options;

    const key = this.generateKey(originalFileName);
    const filePath = this.getFilePath(key);
    const mimeType = contentType || mime.lookup(originalFileName) || 'application/octet-stream';

    // Stream to file
    const writeStream = createWriteStream(filePath);
    await pipeline(stream, writeStream);

    // Get file stats
    const stats = await fs.stat(filePath);

    return {
      key,
      url: isPublic ? this.getPublicUrl(key) : null,
      thumbnails: null,
      metadata: {
        size: stats.size,
        contentType: mimeType,
        originalFileName,
        actorId,
        title,
        summary,
      },
    };
  }

  async delete(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);

      // Also try to delete thumbnails
      const thumbDir = path.join(this.storagePath, 'thumbnails');
      const baseName = key.replace(/\.[^.]+$/, '');
      try {
        const files = await fs.readdir(thumbDir);
        for (const file of files) {
          if (file.startsWith(baseName + '_')) {
            await fs.unlink(path.join(thumbDir, file));
          }
        }
      } catch {
        // Thumbnails dir might not exist
      }

      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }

  async exists(key) {
    const filePath = this.getFilePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPublicUrl(key) {
    return `${this.urlPrefix}/${key}`;
  }

  async getSignedUrl(key, expiresIn = 3600) {
    // For local adapter, generate a simple HMAC-signed URL
    const expires = Math.floor(Date.now() / 1000) + expiresIn;
    const secret = process.env.JWT_SECRET || 'local-dev-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${key}:${expires}`)
      .digest('hex')
      .slice(0, 16);

    return `${this.urlPrefix}/${key}?expires=${expires}&sig=${signature}`;
  }

  /**
   * Verify a signed URL (for use in file serving middleware)
   */
  static verifySignedUrl(key, expires, signature) {
    const secret = process.env.JWT_SECRET || 'local-dev-secret';
    const now = Math.floor(Date.now() / 1000);

    if (now > parseInt(expires, 10)) {
      return false; // Expired
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${key}:${expires}`)
      .digest('hex')
      .slice(0, 16);

    return signature === expected;
  }

  async getMetadata(key) {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    const mimeType = mime.lookup(key) || 'application/octet-stream';

    const metadata = {
      size: stats.size,
      contentType: mimeType,
      lastModified: stats.mtime,
    };

    // Try to get image dimensions
    if (isImageMimeType(mimeType)) {
      try {
        const buffer = await fs.readFile(filePath);
        const imageMetadata = await getImageMetadata(buffer);
        metadata.width = imageMetadata.width;
        metadata.height = imageMetadata.height;
      } catch {
        // Ignore errors getting image metadata
      }
    }

    return metadata;
  }

  async getStream(key) {
    const filePath = this.getFilePath(key);
    return createReadStream(filePath);
  }
}
