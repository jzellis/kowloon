// This is basically just fetch with added headers for Kowloon authentication, a post body and returned body parsing.

export default async function (url, body, actorId) {
  try {
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) {
      return res.headers.get("content-type").indexOf("json") !== -1
        ? await res.json()
        : await res.text();
    }
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
}
