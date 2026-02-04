// GCSAdapter.js
// Google Cloud Storage adapter

import { Storage } from '@google-cloud/storage';
import StorageAdapter from '../StorageAdapter.js';
import { generateThumbnails, isImageMimeType, getImageMetadata } from '../thumbnail.js';
import mime from 'mime-types';

export default class GCSAdapter extends StorageAdapter {
  constructor(config = {}) {
    super(config);

    this.bucketName = config.bucket;
    this.cdnUrl = config.cdnUrl;

    if (!this.bucketName) {
      throw new Error('GCSAdapter requires bucket configuration');
    }

    const storageConfig = {};
    if (config.projectId) {
      storageConfig.projectId = config.projectId;
    }
    if (config.keyFilename) {
      storageConfig.keyFilename = config.keyFilename;
    }

    this.storage = new Storage(storageConfig);
    this.bucket = this.storage.bucket(this.bucketName);
  }

  async upload(buffer, options) {
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
    const mimeType = contentType || mime.lookup(originalFileName) || 'application/octet-stream';

    const file = this.bucket.file(key);

    await file.save(buffer, {
      contentType: mimeType,
      metadata: {
        metadata: {
          originalFileName,
          actorId: actorId || '',
          title: title || '',
          summary: summary || '',
        },
      },
    });

    if (isPublic) {
      await file.makePublic();
    }

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

    // Generate and upload thumbnails
    if (generateThumbnail && isImageMimeType(mimeType)) {
      try {
        const imageMetadata = await getImageMetadata(buffer);
        result.metadata.width = imageMetadata.width;
        result.metadata.height = imageMetadata.height;

        const thumbnails = await generateThumbnails(buffer, thumbnailSizes);
        result.thumbnails = {};

        for (const [size, thumbBuffer] of Object.entries(thumbnails)) {
          const thumbKey = `thumbnails/${key.replace(/\.[^.]+$/, '')}_${size}.webp`;
          const thumbFile = this.bucket.file(thumbKey);

          await thumbFile.save(thumbBuffer, {
            contentType: 'image/webp',
          });

          if (isPublic) {
            await thumbFile.makePublic();
          }

          result.thumbnails[size] = this.getPublicUrl(thumbKey);
        }
      } catch (err) {
        console.error('[GCSAdapter] Thumbnail generation failed:', err.message);
      }
    }

    return result;
  }

  async uploadStream(stream, options) {
    const {
      originalFileName,
      actorId,
      title,
      summary,
      contentType,
      size,
      isPublic = true,
    } = options;

    const key = this.generateKey(originalFileName);
    const mimeType = contentType || mime.lookup(originalFileName) || 'application/octet-stream';

    const file = this.bucket.file(key);
    const writeStream = file.createWriteStream({
      contentType: mimeType,
      metadata: {
        metadata: {
          originalFileName,
          actorId: actorId || '',
          title: title || '',
          summary: summary || '',
        },
      },
    });

    await new Promise((resolve, reject) => {
      stream.pipe(writeStream).on('finish', resolve).on('error', reject);
    });

    if (isPublic) {
      await file.makePublic();
    }

    return {
      key,
      url: isPublic ? this.getPublicUrl(key) : null,
      thumbnails: null,
      metadata: {
        size: size || null,
        contentType: mimeType,
        originalFileName,
        actorId,
        title,
        summary,
      },
    };
  }

  async delete(key) {
    try {
      await this.bucket.file(key).delete();

      // Try to delete thumbnails
      const baseName = key.replace(/\.[^.]+$/, '');
      for (const size of [200, 400, 800, 1200]) {
        try {
          await this.bucket.file(`thumbnails/${baseName}_${size}.webp`).delete();
        } catch {
          // Thumbnail might not exist
        }
      }

      return true;
    } catch (err) {
      if (err.code === 404) return false;
      throw err;
    }
  }

  async exists(key) {
    const [exists] = await this.bucket.file(key).exists();
    return exists;
  }

  getPublicUrl(key) {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  async getSignedUrl(key, expiresIn = 3600) {
    const [url] = await this.bucket.file(key).getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    return url;
  }

  async getMetadata(key) {
    const [metadata] = await this.bucket.file(key).getMetadata();

    return {
      size: parseInt(metadata.size, 10),
      contentType: metadata.contentType,
      lastModified: new Date(metadata.updated),
      etag: metadata.etag,
      metadata: metadata.metadata,
    };
  }

  async getStream(key) {
    return this.bucket.file(key).createReadStream();
  }
}
