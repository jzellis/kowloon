// This is basically just fetch with added headers for Kowloon authentication and body parsing.

import createUserSignature from "./createUserSignature.js";
import createServerSignature from "./createServerSignature.js";

export default async function (url, actorId) {
  let serverCreds = await createServerSignature();
  const headers = {
    "Content-Type": "application/json",
    Accepts: "application/json",
    "Kowloon-Server-Id": serverCreds.id,
    "Kowloon-Server-Timestamp": serverCreds.timestamp,
    "Kowloon-Server-Signature": serverCreds.signature,
  };

  if (actorId) {
    headers["Kowloon-Id"] = actorId;
    headers["Kowloon-Timestamp"] = Date.now();
    headers["Kowloon-Signature"] = await createUserSignature(
      actorId,
      Date.now()
    );
  }

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
    return new Error(e);
  }
}
