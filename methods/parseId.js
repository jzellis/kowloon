// parseId.js (refactored)
// Parses ANY Kowloon ID into a structured object.
// Supported forms:
//  1) User:          "@username@host.tld"
//  2) Object:        "type:dbid@host.tld"   (type is lowercase, e.g., post, event, group, activity, file, page, circle, bookmark)
//  3) Public:        "@public"
//  4) Server pseudo: "@host.tld"            (legacy/server actor helper)
//  5) acct alias:    "username@host.tld"    (normalized as a User)
//  6) URL:           "https://host/..."
// Returns minimal stable fields used today (id, type, server)
// and extra helpers (host, username, dbid, objectType, isUser, isObject, isUrl).

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

export default function parseId(id) {
  if (!id || typeof id !== "string") return false;

  // 1) @public
  if (id === "@public") {
    return {
      id,
      type: "Public",
      server: "",
      host: "",
      isUser: false,
      isObject: false,
      isUrl: false,
    };
  }

  // 2) URL
  if (id.startsWith("http://") || id.startsWith("https://")) {
    try {
      const u = new URL(id);
      return {
        id,
        type: "Url",
        server: u.hostname, // keep legacy field name
        host: u.hostname, // explicit alias
        isUser: false,
        isObject: false,
        isUrl: true,
      };
    } catch {
      return false;
    }
  }

  // 3) Canonical User: @username@host
  const mUser = id.match(/^@([^@]+)@([^@/]+)$/);
  if (mUser) {
    const [, username, host] = mUser;
    return {
      id,
      type: "User",
      server: host,
      host,
      username,
      uid: username, // legacy-friendly "uid" (username for users)
      isUser: true,
      isObject: false,
      isUrl: false,
    };
  }

  // 4) Object: type:dbid@host   (type lowercase)
  const mObj = id.match(/^([a-z]+):([A-Za-z0-9]+)@([^@/]+)$/);
  if (mObj) {
    const [, tLower, dbid, host] = mObj;
    return {
      id,
      type: cap(tLower), // e.g., "Post", "Event", "Group", "Activity", ...
      objectType: cap(tLower),
      server: host,
      host,
      dbid,
      uid: dbid, // legacy-friendly "uid" (dbid for objects)
      isUser: false,
      isObject: true,
      isUrl: false,
    };
  }

  // 5) acct-style user (alias): username@host  → normalize as User
  // (Useful for inputs; canonical form elsewhere remains "@username@host")
  const mAcct = id.match(/^([^@]+)@([^@/]+)$/);
  if (mAcct) {
    const [, username, host] = mAcct;
    return {
      id,
      type: "User",
      server: host,
      host,
      username,
      uid: username,
      isUser: true,
      isObject: false,
      isUrl: false,
    };
  }

  // 6) Server pseudo-id: @host
  const mServer = id.match(/^@([^@/]+)$/);
  if (mServer) {
    const [, host] = mServer;
    return {
      id,
      type: "Server",
      server: host,
      host,
      isUser: false,
      isObject: false,
      isUrl: false,
    };
  }

  // Unknown form
  return false;
}
