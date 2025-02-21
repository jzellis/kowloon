export default async function (server, users) {
  let url = `https://${server}/outbox`;
  users = encodeURIComponent(users);
  url += `?from=${users}`;
  return url;
}
