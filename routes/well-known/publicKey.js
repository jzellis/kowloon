import Kowloon from "../../Kowloon.js";

export default async function (req, res, next) {
  let status = 200;
  res.send(Kowloon.settings.publicKey);
}
