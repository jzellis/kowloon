// Mention parsing + linkify. PURE string helpers with NO schema/settings imports,
// so schema files (Post, Reply) can import them without a circular dependency.
//
// A Kowloon mention is a handle written inline as @username@domain — the same
// form as a User id. We linkify ANY syntactically-valid handle (local OR remote)
// to that server's profile URL: https://<domain>/users/@username@domain — the
// form both the web router and the mobile app (openKowloonLink) route straight
// to a profile. Notifying, by contrast, is local-only (see ./notify.js).

// Leading boundary (start-of-string or a char that isn't a word char / @ / /)
// keeps us from matching email addresses (foo@bar has a word char before the @)
// or the domain half of another handle.
const MENTION_RE =
  /(^|[^\w@/])@([a-zA-Z0-9._-]+)@([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})/g;

// Extract unique mentions from raw content → [{ handle, username, domain }].
export function extractMentions(content) {
  if (!content || typeof content !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const m of content.matchAll(MENTION_RE)) {
    const username = m[2];
    const domain = m[3].toLowerCase();
    const handle = `@${username}@${domain}`;
    if (seen.has(handle)) continue;
    seen.add(handle);
    out.push({ handle, username, domain });
  }
  return out;
}

// Rewrite each handle in markdown source into a profile link, preserving the
// character before the @ (the boundary the regex captured). Idempotent on raw
// user text — there are no existing links to double-wrap.
export function linkifyMentions(content) {
  if (!content || typeof content !== "string") return content ?? "";
  return content.replace(MENTION_RE, (_full, pre, username, domain) => {
    const d = domain.toLowerCase();
    return `${pre}[@${username}@${d}](https://${d}/users/@${username}@${d})`;
  });
}
