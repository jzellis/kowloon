// This is basically just fetch with added headers for Kowloon authentication and body parsing.

export default async function (url, actorId) {
  try {
    let res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (res.ok) {
      return res.headers.get("content-type").indexOf("json") !== -1
        ? await res.json()
        : await res.text();
    }
  } catch (e) {
    throw new Error(e);
  }
}
