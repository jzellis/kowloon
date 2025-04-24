// This parses any Kowloon ID and returns an object with the ID's object type, uid (username or uuid) and its server

const capitalizeFirstLetter = function (val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
};

export default function (id) {
  if (!id) return false;
  let returned;
  if (id === "@public")
    return {
      id,
      type: "Public",
      server: "",
    };

  let isUrl = id.startsWith("http");

  switch (true) {
    case isUrl === true:
      returned = {
        id,
        type: "Url",
        server: new URL(id).hostname,
      };
      break;
    case !isUrl && id.split("@")[0].indexOf(":") != -1:
      returned = {
        id,
        type:
          String(id.split("@")[0].split(":")[0]).charAt(0).toUpperCase() +
          String(id.split("@")[0].split(":")[0]).slice(1),

        server: id.split("@").pop(),
      };
      break;
    case !isUrl &&
      id.split("@")[0].indexOf(":") == -1 &&
      id.split("@").length === 3:
      returned = {
        id,
        type: "User",
        server: id.split("@").slice(2)[0],
      };
      break;
    case !id.startsWith("http") &&
      id.split("@")[0].indexOf(":") == -1 &&
      id.split("@").length === 2:
      returned = {
        id,
        type: "Server",
        server: id.split("@").slice(1)[0],
      };
      break;
    default:
      return false;
  }
  return returned;
}
