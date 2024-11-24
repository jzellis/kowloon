// This returns an object with the ID's object type, uid (username or uuid) and its server
export default function (id) {
  let returned = {};
  if (id.indexOf("@") === -1) return id;
  switch (true) {
    case id === "@public":
      returned = { type: "Public", uid: "public" };
      break;
    case id === "@server":
      returned = { type: "Server", uid: "server" };
      break;
    case id.startsWith("@") === true:
      returned = { type: "User", uid: id.split("@")[1] };
      break;
    case id.includes(":") === true:
      returned = {
        type:
          id.split(":")[0].charAt(0).toUpperCase() + id.split(":")[0].slice(1),
        uid: id.split(":")[1].split("@").slice(0)[0],
      };
      break;
  }
  returned.server = id.split("@").slice(-1)[0];
  return returned;
}
