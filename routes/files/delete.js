// /routes/files/delete.js
// DELETE /files/:key - Delete a file

import route from '../utils/route.js';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';

export default route(
  async ({ params, user, setStatus, set }) => {
    const { key } = params;

    if (!key) {
      setStatus(400);
      set('error', 'File key is required');
      return;
    }

    if (!user?.id) {
      setStatus(401);
      set('error', 'Authentication required');
      return;
    }

    try {
      // Find the file record
      let file = await File.findOne({ storageKey: key });
      if (!file) {
        file = await File.findOne({ id: key });
      }
      if (!file) {
        file = await File.findOne({ id: `file:${key}` });
      }

      if (!file) {
        setStatus(404);
        set('error', 'File not found');
        return;
      }

      // Check ownership (or admin status)
      if (file.actorId !== user.id) {
        // TODO: Add admin check here
        setStatus(403);
        set('error', 'You can only delete your own files');
        return;
      }

      // Delete from storage
      const storage = await getStorageAdapter();
      const storageKey = file.storageKey || key;
      await storage.delete(storageKey);

      // Soft delete in database (or hard delete)
      file.deletedAt = new Date();
      await file.save();

      setStatus(200);
      set('deleted', true);
      set('id', file.id);
    } catch (error) {
      console.error('[files/delete] Error:', error);
      setStatus(500);
      set('error', error.message || 'Failed to delete file');
    }
  },
  { allowUnauth: false }
);
