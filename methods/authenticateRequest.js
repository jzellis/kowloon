// OK, so what this does is it takes an id, a timestamp and a signature that should be the id and timestamp signed with the user/server's private key (see createUserSignature() and createServerSignature()). It then sees if the user is local and, if so, runs verifyUserSignature and returns the user. If not, it loads the user's remote profile and verifies the signature against the user's public key. Ditto servers. There should never be a server request to itself, so it doesn't do that.

import { User, Circle } from "../schema/index.js";
import getSettings from "./getSettings.js";
import verifyUserSignature from "./verifyUserSignature.js";
import verifyServerSignature from "./verifyServerSignature.js";
import crypto from "crypto";
import parseId from "./parseId.js";

export default async function (userCreds, serverCreds) {
  let result = {};
  const settings = await getSettings();
  let parsedId = parseId(userCreds.id);

  if (parsedId.server === settings.domain) {
    // If user is local
    let isValidUser = await verifyUserSignature(
      userCreds.id,
      userCreds.timestamp,
      userCreds.signature
    );

    if (!isValidUser) return false;
    result.user = await User.findOne({ id: userCreds.id }).select(
      "_id id username profile prefs publicKey"
    );
  } else {
    // If user is remote
    url = `https://${parsed.server}/users/${userCreds.id}`;
    let request = await fetch(url, { headers });
    if (request.ok) response = await request.json();
    let remoteUser = response.user;
    let token = userCreds.id + ":" + userCreds.timestamp;
    let hash = crypto.createHash("sha256").update(token).digest();
    let isValid = crypto.verify(
      "sha256",
      hash,
      remoteUser.publicKey,
      Buffer.from(signature, "base64")
    );
    if (isValid) result.user = remoteUser;
  }

  return result;
}
