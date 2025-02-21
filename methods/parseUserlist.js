import parseId from "./parseId.js";

export default function (userlist) {
  let domains = {};

  userlist.map((i) => {
    let domain = parseId(i).server;
    if (!domains[domain]) domains[domain] = [];
    domains[domain].push(i);
  });

  return domains;
}
