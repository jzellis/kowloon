const kowloonId = function (id) {
  try {
    const parsed = new URL(id);
    // If it parses cleanly, treat it as a URL
    return {
      type: "URL",
      domain: parsed.hostname,
      userId: null,
    };
  } catch {
    // not a valid URL  fall through to normal handling
  }
  const domain = id.split("@").pop();
  if (id.startsWith("@")) {
    return { type: "User", domain, userId: id };
  }
  const [left] = id.split("@");
  const [typeLower] = left.split(":"); // objecttype:uuid
  const type = typeLower.charAt(0).toUpperCase() + typeLower.slice(1);
  return { type, domain, userId: null };
};

export default kowloonId;
