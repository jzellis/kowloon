export default async function (serverId) {
  const domain = serverId.indexOf("@") > 0 ? serverId.split("@")[1] : serverId;

  let response,
    request = await fetch(`https://${domain}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

  if (request.ok) response = await request.json();
  return response.server;
}
