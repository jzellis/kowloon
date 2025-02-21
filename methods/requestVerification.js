import crypto from "crypto";
import post from "./post.js";
import User from "../schema/User.js";
import parseID from "./parseID.js";
export default async function (id, publicKey) {
  let original = crypto.randomBytes(20).toString("hex");
  // let encrypted;
  // try {
  //   encrypted = crypto.publicEncrypt(publicKey, original).toString("base64");
  // } catch (e) {
  //   return { error: "Verification failed, public key invalid" };
  // }
  // let server = id.split("@")[2];
  // let body = {
  //   actorId: id,
  //   token: encrypted,
  // };
  // try {
  //   let response = await post(`https://${server}/verify`, {
  //     actorId: id,
  //     body,
  //   });
  //   return response == original
  //     ? await User.findOne({ id }, "username profile publicKey")
  //     : false;
  // } catch (e) {
  //   return { error: e };
  // }
}
