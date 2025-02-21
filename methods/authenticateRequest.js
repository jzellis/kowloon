// OK, so what this does is it takes an id, a timestamp and a signature that should be the id and timestamp signed with the user/server's private key (see createUserSignature() and createServerSignature()). It then sees if the user is local and, if so, runs verifyUserSignature and returns the user. If not, it loads the user's remote profile and verifies the signature against the user's public key. Ditto servers. There should never be a server request to itself, so it doesn't do that.

import { User, Circle } from "../schema/index.js";
import getSettings from "./getSettings.js";
import verifyUserSignature from "./verifyUserSignature.js";
import verifyServerSignature from "./verifyServerSignature.js";
import crypto from "crypto";
import parseId from "./parseId.js";
import getUser from "./getUser.js";
export default async function (
  id,
  timestamp,
  signature,
  serverId,
  serverTimestamp,
  serverSignature
) {
  const settings = await getSettings();
  if (!id) return { error: "No ID provided" };
  if (!timestamp) return { error: "No timestamp provided" };
  if (!signature) return { error: "No signature provided" };
  let result = {};
  let url, request, response, token, hash;
  let headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  let parsed = parseId(id);

  if (parsed.type === "user") {
    if (parsed.server === settings.domain) {
      let isValid = await verifyUserSignature(id, timestamp, signature);
      if (isValid)
        result.user = await User.findOne({ id })
          .lean()
          .select("-_id id url username profile publicKey blocked muted");
      result.user.blocked = (
        await Circle.findOne({ id: result.user.blocked }).select("members")
      ).members.map((m) => m.id);
      result.user.muted = (
        await Circle.findOne({ id: result.user.muted }).select("members")
      ).members.map((m) => m.id);
    } else {
      url = `https://${parsed.server}/users/${parsed.id}`;
      request = await fetch(url, { headers });
      if (request.ok) response = await request.json();
      let remoteUser = response.user;
      token = id + ":" + timestamp;
      hash = crypto.createHash("sha256").update(token).digest();
      let isValid = crypto.verify(
        "sha256",
        hash,
        remoteUser.publicKey,
        Buffer.from(signature, "base64")
      );
      if (isValid) result.user = response;
    }
  }

  if (serverId && serverTimestamp && serverSignature) {
    url = `https://${parsed.server}/`;
    request = await fetch(url, { headers });
    if (request.ok) response = await request.json();
    let remoteServer = response.server;
    token = serverId + ":" + serverTimestamp;
    hash = crypto.createHash("sha256").update(token).digest();
    let isValid = crypto.verify(
      "sha256",
      hash,
      remoteServer.publicKey,
      Buffer.from(serverSignature, "base64")
    );
    if (isValid) result.server = response.server;
  }

  // if (type === "user") {
  //   console.log(
  //     "User is verified:",
  //     await verifyUserSignature(id, timestamp, signature)
  //   );
  //   let user = (await verifyUserSignature(id, timestamp, signature))
  //     ? await getUser(id)
  //     : null;
  //   if (!user) {
  //     let parsed = parseId(id);
  //     let url = `https://${parsed.server}/users/${parsed.id}`;
  //     let response,
  //       request = await fetch(url, { headers });
  //     if (request.ok) response = await request.json();
  //     let remoteUser = response.user;

  //     const token = id + ":" + timestamp;
  //     const hash = crypto.createHash("sha256").update(token).digest();
  // const isValid = crypto.verify(
  //   "sha256",
  //   hash,
  //   remoteUser.publicKey,
  //   Buffer.from(signature, "base64")
  // );
  //     if (isValid) result.user = remoteUser;
  //   }
  // } else {
  //   let parsed = parseId(id);
  //   let url = `https://${parsed.server}/`;
  //   let response,
  //     request = await fetch(url, { headers });
  //   if (request.ok) response = await request.json();
  //   let remoteServer = response.server;

  //   const token = id + ":" + timestamp;
  //   const hash = crypto.createHash("sha256").update(token).digest();
  //   const isValid = crypto.verify(
  //     "sha256",
  //     hash,
  //     remoteServer.publicKey,
  //     Buffer.from(signature, "base64")
  //   );
  //   if (isValid) result.server = remoteServer;
  // }

  // return result;
  return result;
}
