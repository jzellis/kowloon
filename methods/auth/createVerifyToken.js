import crypto from "crypto";
export default function (id, publicKey) {
  let token = crypto.randomBytes(20).toString("hex");
  // let token = "doing the butt";
  try {
    return {
      original: token,
      encrypted: crypto.publicEncrypt(publicKey, token).toString("base64"),
    };
  } catch (e) {
    console.log(e);
    return { error: e };
  }
}
