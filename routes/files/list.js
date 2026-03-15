// /routes/files/list.js
// GET /files - List the authenticated user's uploaded files

import route from '../utils/route.js';
import File from '#schema/File.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default route(
  async ({ query, user, setStatus, set }) => {
    const page  = Math.max(1, parseInt(query.page  || '1',  10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit || String(DEFAULT_LIMIT), 10)));
    const type  = query.type; // Image, Video, Audio, Document

    const filter = { actorId: user.id, deletedAt: null };
    if (type) filter.type = type;

    const [files, total] = await Promise.all([
      File.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      File.countDocuments(filter),
    ]);

    set('files', files);
    set('total', total);
    set('page', page);
    set('limit', limit);
    set('pages', Math.ceil(total / limit));
  },
  { allowUnauth: false }
);
