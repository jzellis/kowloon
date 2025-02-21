// This returns an object with the ID's object type, uid (username or uuid) and its server

export default function (id) {
  let returned = {};
  let splitId = id.split("@");

  returned =
    splitId.length < 2
      ? { id, type: "rss", user: "", server: new URL(id).hostname }
      : splitId.length === 3
      ? { id, type: "user", user: splitId[1], server: splitId[2] }
      : { id, type: "server", user: "", server: splitId[1] };

  return returned;
}
