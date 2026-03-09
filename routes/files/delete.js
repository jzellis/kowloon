// /routes/files/delete.js
// DELETE /files/:key - Delete a file

import route from '../utils/route.js';
import File from '#schema/File.js';
import { getStorageAdapter } from '#methods/files/index.js';
import isServerAdmin from '#methods/auth/isServerAdmin.js';

export default route(
  async ({ params, user, setStatus, set }) => {
    const { key } = params;

    if (!key) {
      setStatus(400);
      set('error', 'File key is required');
      return;
    }

    // Find the file record
    let file = await File.findOne({ storageKey: key, deletedAt: null });
    if (!file) file = await File.findOne({ id: key, deletedAt: null });
    if (!file) file = await File.findOne({ id: `file:${key}`, deletedAt: null });

    if (!file) {
      setStatus(404);
      set('error', 'File not found');
      return;
    }

    // Owner or server admin may delete
    const admin = await isServerAdmin(user.id);
    if (file.actorId !== user.id && !admin) {
      setStatus(403);
      set('error', 'You can only delete your own files');
      return;
    }

    // Delete from storage backend
    try {
      const storage = await getStorageAdapter();
      await storage.delete(file.storageKey || key);
    } catch (err) {
      console.error('[files/delete] Storage delete error (continuing with DB soft-delete):', err.message);
    }

    // Soft-delete the DB record
    file.deletedAt = new Date();
    await file.save();

    setStatus(200);
    set('deleted', true);
    set('id', file.id);
  },
  { allowUnauth: false }
);
