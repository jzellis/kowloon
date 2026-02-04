// thumbnail.js
// Image thumbnail generation using sharp

let sharp = null;

// Lazy-load sharp to avoid requiring it if not needed
async function getSharp() {
  if (!sharp) {
    try {
      const module = await import('sharp');
      sharp = module.default;
    } catch (err) {
      throw new Error(
        'sharp is required for thumbnail generation. Install it with: npm install sharp'
      );
    }
  }
  return sharp;
}

// MIME types that can be processed for thumbnails
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
  'image/svg+xml',
]);

/**
 * Check if a MIME type is an image that can have thumbnails generated
 * @param {string} mimeType
 * @returns {boolean}
 */
export function isImageMimeType(mimeType) {
  return IMAGE_MIME_TYPES.has(mimeType?.toLowerCase());
}

/**
 * Get image metadata (dimensions, format)
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<Object>} Metadata object with width, height, format
 */
export async function getImageMetadata(buffer) {
  const sharpLib = await getSharp();
  const metadata = await sharpLib(buffer).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    hasAlpha: metadata.hasAlpha,
    orientation: metadata.orientation,
  };
}

/**
 * Generate thumbnails at specified widths
 * Maintains aspect ratio, outputs as WebP for efficiency
 *
 * @param {Buffer} buffer - Original image buffer
 * @param {number[]} sizes - Array of thumbnail widths (e.g., [200, 400, 800])
 * @param {Object} [options] - Processing options
 * @param {string} [options.format='webp'] - Output format (webp, jpeg, png)
 * @param {number} [options.quality=80] - Output quality (1-100)
 * @param {boolean} [options.withMetadata=false] - Preserve EXIF data
 * @returns {Promise<Object>} Object mapping size to thumbnail buffer { '200': Buffer, '400': Buffer }
 */
export async function generateThumbnails(buffer, sizes = [200, 400], options = {}) {
  const sharpLib = await getSharp();
  const { format = 'webp', quality = 80, withMetadata = false } = options;

  // Get original dimensions
  const metadata = await sharpLib(buffer).metadata();
  const originalWidth = metadata.width;

  const thumbnails = {};

  for (const width of sizes) {
    // Skip if thumbnail would be larger than original
    if (width >= originalWidth) {
      continue;
    }

    let pipeline = sharpLib(buffer)
      .rotate() // Auto-rotate based on EXIF orientation
      .resize(width, null, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    // Apply format-specific options
    switch (format) {
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
      case 'jpeg':
      case 'jpg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ compressionLevel: 9 });
        break;
      case 'avif':
        pipeline = pipeline.avif({ quality });
        break;
      default:
        pipeline = pipeline.webp({ quality });
    }

    if (withMetadata) {
      pipeline = pipeline.withMetadata();
    }

    thumbnails[width] = await pipeline.toBuffer();
  }

  return thumbnails;
}

/**
 * Generate a blurhash for an image (for progressive loading)
 * @param {Buffer} buffer - Image buffer
 * @param {number} [componentX=4] - Horizontal components
 * @param {number} [componentY=3] - Vertical components
 * @returns {Promise<string>} Blurhash string
 */
export async function generateBlurhash(buffer, componentX = 4, componentY = 3) {
  // Blurhash requires an additional dependency
  let encode;
  try {
    const blurhash = await import('blurhash');
    encode = blurhash.encode;
  } catch {
    throw new Error(
      'blurhash is required for generateBlurhash(). Install it with: npm install blurhash'
    );
  }

  const sharpLib = await getSharp();

  // Resize to small size for blurhash calculation
  const { data, info } = await sharpLib(buffer)
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, componentX, componentY);
}

/**
 * Optimize an image without resizing
 * @param {Buffer} buffer - Image buffer
 * @param {Object} [options] - Processing options
 * @param {string} [options.format] - Output format (defaults to input format)
 * @param {number} [options.quality=80] - Output quality
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImage(buffer, options = {}) {
  const sharpLib = await getSharp();
  const { format, quality = 80 } = options;

  const metadata = await sharpLib(buffer).metadata();
  const outputFormat = format || metadata.format || 'jpeg';

  let pipeline = sharpLib(buffer).rotate(); // Auto-rotate based on EXIF

  switch (outputFormat) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
    case 'jpg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
    case 'avif':
      pipeline = pipeline.avif({ quality });
      break;
    default:
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  return pipeline.toBuffer();
}

export default {
  isImageMimeType,
  getImageMetadata,
  generateThumbnails,
  generateBlurhash,
  optimizeImage,
};
