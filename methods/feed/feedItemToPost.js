// feedItemToPost.js
// Normalize a FeedItems document into the Post-shaped response object the API returns.
//
// FeedItems stores:
//   - Top-level: id, actorId, type, objectType, to (coarse enum), canReply, canReact,
//                publishedAt, group, tombstoned
//   - doc.object: sanitized Post content (body, image, attachments, tags, location, etc.)
//     with to/canReply/canReact/source stripped out
//
// The coarse `to` enum ("public"|"server"|"audience") is mapped back to the "@public" /
// "@<domain>" / group-ID strings that the frontend and AP clients expect.

import { getSetting } from '#methods/settings/cache.js';

export default function feedItemToPost(doc) {
  const obj = doc.object ?? {};
  const domain = getSetting('domain');

  // Map coarse visibility back to AP-style addressing
  let to;
  if (doc.to === 'public') {
    to = '@public';
  } else if (doc.to === 'server') {
    to = `@${domain}`;
  } else if (doc.group) {
    // Group-addressed post — restore the group ID as the audience
    to = doc.group;
  } else {
    // audience-addressed (circle) or unknown — keep whatever object stored
    to = obj.to ?? 'audience';
  }

  return {
    // Top-level FeedItems fields take precedence (always authoritative)
    ...obj,
    id:          doc.id          ?? obj.id,
    type:        doc.type        ?? obj.type,
    objectType:  doc.objectType  ?? obj.objectType,
    actorId:     doc.actorId     ?? obj.actorId,
    actor:       obj.actor       ?? null,
    to,
    canReply:    doc.canReply    ?? obj.canReply    ?? 'public',
    canReact:    doc.canReact    ?? obj.canReact    ?? 'public',
    // Timestamps
    publishedAt: doc.publishedAt ?? obj.publishedAt ?? obj.createdAt,
    createdAt:   doc.publishedAt ?? obj.createdAt,
    updatedAt:   doc.updatedAt   ?? obj.updatedAt,
    // Counts (live in object, kept there by the React/Reply handlers)
    replyCount:  obj.replyCount  ?? 0,
    reactCount:  obj.reactCount  ?? 0,
    reactPreview: obj.reactPreview ?? null,
    shareCount:  obj.shareCount  ?? 0,
    // Event dates — map nested schema fields to flat API fields
    startTime:   (doc.type === 'Event' || obj.type === 'Event') ? (obj.event?.startDate ?? null) : undefined,
    endTime:     (doc.type === 'Event' || obj.type === 'Event') ? (obj.event?.endDate   ?? null) : undefined,
  };
}
