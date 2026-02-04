// S3Adapter.js
// Amazon S3 and MinIO compatible storage adapter

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import StorageAdapter from '../StorageAdapter.js';
import { generateThumbnails, isImageMimeType, getImageMetadata } from '../thumbnail.js';
import mime from 'mime-types';

export default class S3Adapter extends StorageAdapter {
  constructor(config = {}) {
    super(config);

    this.bucket = config.bucket;
    this.publicUrl = config.publicUrl; // Optional CDN URL

    if (!this.bucket) {
      throw new Error('S3Adapter requires bucket configuration');
    }

    this.client = new S3Client({
      region: config.region || 'us-east-1',
      endpoint: config.endpoint, // For MinIO
      credentials: config.accessKeyId
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
      forcePathStyle: config.forcePathStyle || false, // Required for MinIO
    });
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

    // Upload main file
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: isPublic ? 'public-read' : 'private',
        Metadata: {
          'original-filename': originalFileName,
          'actor-id': actorId || '',
          title: title || '',
          summary: summary || '',
        },
      })
    );

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

    // Generate and upload thumbnails for images
    if (generateThumbnail && isImageMimeType(mimeType)) {
      try {
        const imageMetadata = await getImageMetadata(buffer);
        result.metadata.width = imageMetadata.width;
        result.metadata.height = imageMetadata.height;

        const thumbnails = await generateThumbnails(buffer, thumbnailSizes);
        result.thumbnails = {};

        for (const [size, thumbBuffer] of Object.entries(thumbnails)) {
          const thumbKey = `thumbnails/${key.replace(/\.[^.]+$/, '')}_${size}.webp`;

          await this.client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: thumbKey,
              Body: thumbBuffer,
              ContentType: 'image/webp',
              ACL: isPublic ? 'public-read' : 'private',
            })
          );

          result.thumbnails[size] = this.getPublicUrl(thumbKey);
        }
      } catch (err) {
        console.error('[S3Adapter] Thumbnail generation failed:', err.message);
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

    // Use multipart upload for streams
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: stream,
        ContentType: mimeType,
        ACL: isPublic ? 'public-read' : 'private',
        Metadata: {
          'original-filename': originalFileName,
          'actor-id': actorId || '',
          title: title || '',
          summary: summary || '',
        },
      },
    });

    await upload.done();

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
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      // Try to delete thumbnails
      const baseName = key.replace(/\.[^.]+$/, '');
      for (const size of [200, 400, 800, 1200]) {
        try {
          await this.client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: `thumbnails/${baseName}_${size}.webp`,
            })
          );
        } catch {
          // Thumbnail might not exist
        }
      }

      return true;
    } catch (err) {
      if (err.name === 'NoSuchKey') return false;
      throw err;
    }
  }

  async exists(key) {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );
      return true;
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }

  getPublicUrl(key) {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }

    // Construct URL from endpoint/bucket
    if (this.config.endpoint) {
      // MinIO style
      return `${this.config.endpoint}/${this.bucket}/${key}`;
    }

    // Standard S3 URL
    const region = this.config.region || 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getS3SignedUrl(this.client, command, { expiresIn });
  }

  async getMetadata(key) {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      etag: response.ETag,
      metadata: response.Metadata,
    };
  }

  async getStream(key) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    return response.Body;
  }
}
