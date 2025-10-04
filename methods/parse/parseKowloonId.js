const parseKowloonId = function (id) {
  const domain = id.split("@").pop();
  if (id.startsWith("@")) {
    return { type: "User", domain, userId: id };
  }
  const [left] = id.split("@");
  const [typeLower] = left.split(":"); // objecttype:uuid
  const type = typeLower.charAt(0).toUpperCase() + typeLower.slice(1);
  return { type, domain, userId: null };
};

export default parseKowloonId;
