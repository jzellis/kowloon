// AzureAdapter.js
// Azure Blob Storage adapter

import {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import StorageAdapter from '../StorageAdapter.js';
import { generateThumbnails, isImageMimeType, getImageMetadata } from '../thumbnail.js';
import mime from 'mime-types';

export default class AzureAdapter extends StorageAdapter {
  constructor(config = {}) {
    super(config);

    this.container = config.container;
    this.cdnUrl = config.cdnUrl;

    if (!config.connectionString || !this.container) {
      throw new Error('AzureAdapter requires connectionString and container configuration');
    }

    this.serviceClient = BlobServiceClient.fromConnectionString(config.connectionString);
    this.containerClient = this.serviceClient.getContainerClient(this.container);

    // Parse connection string for signed URL generation
    this.parseConnectionString(config.connectionString);
  }

  parseConnectionString(connectionString) {
    const parts = connectionString.split(';').reduce((acc, part) => {
      const [key, ...valueParts] = part.split('=');
      acc[key] = valueParts.join('=');
      return acc;
    }, {});

    this.accountName = parts.AccountName;
    this.accountKey = parts.AccountKey;
    this.accountUrl = `https://${this.accountName}.blob.core.windows.net`;
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

    const blobClient = this.containerClient.getBlockBlobClient(key);

    await blobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
      metadata: {
        originalfilename: originalFileName,
        actorid: actorId || '',
        title: title || '',
        summary: summary || '',
      },
    });

    // Set public access if needed (container-level in Azure)
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
          const thumbBlobClient = this.containerClient.getBlockBlobClient(thumbKey);

          await thumbBlobClient.upload(thumbBuffer, thumbBuffer.length, {
            blobHTTPHeaders: {
              blobContentType: 'image/webp',
            },
          });

          result.thumbnails[size] = this.getPublicUrl(thumbKey);
        }
      } catch (err) {
        console.error('[AzureAdapter] Thumbnail generation failed:', err.message);
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

    const blobClient = this.containerClient.getBlockBlobClient(key);

    await blobClient.uploadStream(stream, undefined, undefined, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
      metadata: {
        originalfilename: originalFileName,
        actorid: actorId || '',
        title: title || '',
        summary: summary || '',
      },
    });

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
      const blobClient = this.containerClient.getBlockBlobClient(key);
      await blobClient.delete();

      // Try to delete thumbnails
      const baseName = key.replace(/\.[^.]+$/, '');
      for (const size of [200, 400, 800, 1200]) {
        try {
          const thumbBlobClient = this.containerClient.getBlockBlobClient(
            `thumbnails/${baseName}_${size}.webp`
          );
          await thumbBlobClient.delete();
        } catch {
          // Thumbnail might not exist
        }
      }

      return true;
    } catch (err) {
      if (err.statusCode === 404) return false;
      throw err;
    }
  }

  async exists(key) {
    const blobClient = this.containerClient.getBlockBlobClient(key);
    return blobClient.exists();
  }

  getPublicUrl(key) {
    if (this.cdnUrl) {
      return `${this.cdnUrl}/${key}`;
    }
    return `${this.accountUrl}/${this.container}/${key}`;
  }

  async getSignedUrl(key, expiresIn = 3600) {
    const blobClient = this.containerClient.getBlockBlobClient(key);

    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiresIn * 1000);

    const sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, this.accountKey);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.container,
        blobName: key,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn,
      },
      sharedKeyCredential
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  async getMetadata(key) {
    const blobClient = this.containerClient.getBlockBlobClient(key);
    const properties = await blobClient.getProperties();

    return {
      size: properties.contentLength,
      contentType: properties.contentType,
      lastModified: properties.lastModified,
      etag: properties.etag,
      metadata: properties.metadata,
    };
  }

  async getStream(key) {
    const blobClient = this.containerClient.getBlockBlobClient(key);
    const response = await blobClient.download();
    return response.readableStreamBody;
  }
}
