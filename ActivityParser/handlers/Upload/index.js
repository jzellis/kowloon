// Upload/index.js
// Handler for the "Upload" Activity type.
// Note: Actual binary upload happens via /files route with multipart/form-data.
// This handler processes Upload activities that reference uploaded files,
// typically to associate them with posts or update metadata.

import File from '#schema/File.js';

/**
 * Type-specific validation for Upload activities
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  // Required: actorId
  if (!activity?.actorId) {
    errors.push("Upload: missing required field 'actorId'");
  }

  // Required: object (file metadata or reference)
  if (!activity?.object) {
    errors.push("Upload: missing required field 'object'");
  }

  // Object must have either an id (existing file) or url (new file reference)
  if (activity?.object && !activity.object.id && !activity.object.url) {
    errors.push("Upload: object must have 'id' or 'url'");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Upload activities are local-only (never federate)
 * File URLs are federated as part of posts, not as separate activities
 */
export async function getFederationTargets() {
  return { shouldFederate: false };
}

export default async function Upload(activity) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join('; ') };
    }

    const { actorId, object, target } = activity;

    // Case 1: Updating an existing file record
    if (object.id) {
      const file = await File.findOne({ id: object.id });

      if (!file) {
        return { activity, error: `File not found: ${object.id}` };
      }

      // Verify ownership
      if (file.actorId !== actorId) {
        return { activity, error: 'Cannot modify file owned by another user' };
      }

      // Update allowed fields
      const updateableFields = ['name', 'summary', 'parentObject'];
      for (const field of updateableFields) {
        if (object[field] !== undefined) {
          file[field] = object[field];
        }
      }

      // If target is specified, associate with a post/object
      if (target) {
        file.parentObject = target;
      }

      await file.save();

      return {
        activity,
        file: file.toObject(),
      };
    }

    // Case 2: Registering a new file (e.g., from external URL or remote source)
    if (object.url) {
      // Check if file already exists with this URL
      let file = await File.findOne({ url: object.url });

      if (file) {
        // File exists, update if owner matches
        if (file.actorId === actorId) {
          if (object.name) file.name = object.name;
          if (object.summary) file.summary = object.summary;
          if (target) file.parentObject = target;
          await file.save();
        }

        return {
          activity,
          file: file.toObject(),
          existing: true,
        };
      }

      // Create new file record for external URL
      file = new File({
        actorId,
        url: object.url,
        name: object.name || object.url.split('/').pop(),
        summary: object.summary,
        type: object.type || inferFileType(object.mediaType),
        mediaType: object.mediaType,
        width: object.width,
        height: object.height,
        size: object.size,
        parentObject: target,
        originalFileName: object.originalFileName || object.url.split('/').pop(),
      });

      await file.save();

      return {
        activity,
        file: file.toObject(),
        created: true,
      };
    }

    return { activity, error: 'No valid file reference provided' };
  } catch (err) {
    console.error('[Upload handler] Error:', err);
    return {
      activity,
      error: err.message || String(err),
    };
  }
}

/**
 * Infer file type category from MIME type
 */
function inferFileType(mimeType) {
  if (!mimeType) return 'Document';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.startsWith('video/')) return 'Video';
  if (mimeType.startsWith('audio/')) return 'Audio';
  return 'Document';
}
