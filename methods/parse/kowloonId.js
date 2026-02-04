// Robustly parse Kowloon IDs (post:abc@domain, @user@domain) without misclassifying as URL.
const ALLOWED_URL_SCHEMES = new Set(["http", "https"]);

function isWebUrl(str) {
  const s = String(str || "").trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false; // must have ://
  try {
    const u = new URL(s);
    return ALLOWED_URL_SCHEMES.has(u.protocol.replace(":", "").toLowerCase());
  } catch {
    return false;
  }
}

function cap(s) {
  s = String(s || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const TYPE_MAP = {
  post: "Post",
  reply: "Reply",
  react: "React",
  group: "Group",
  circle: "Circle",
  page: "Page",
  bookmark: "Bookmark",
  user: "User",
};

export default function kowloonId(raw) {
  const id = String(raw || "").trim();
  if (!id) return { type: "Unknown", domain: null, userId: null };

  // 1) Only http/https with :// count as URL
  if (isWebUrl(id)) {
    const u = new URL(id);
    return { type: "URL", domain: u.hostname || null, userId: null };
  }

  // 2) User ids: "@user@domain" or server shorthand "@domain"
  if (id.startsWith("@")) {
    const parts = id.split("@").filter(Boolean);
    if (parts.length === 2)
      return { type: "User", domain: parts[1], userId: id };
    if (parts.length === 1)
      return { type: "Server", domain: parts[0], userId: null };
    return { type: "User", domain: parts.at(-1) || null, userId: id };
  }

  // 3) Object ids: "kind:local@domain"
  const m = id.match(/^([a-z][a-z0-9_-]*):([^@]+)@([^/\s]+)$/i);
  if (m) {
    const kind = (m[1] || "").toLowerCase();
    const domain = m[3] || null;
    const type = TYPE_MAP[kind] || cap(kind);
    return { type, domain, userId: null };
  }

  const domain = id.includes("@") ? id.split("@").pop() : null;
  return { type: "Id", domain, userId: null };
}
