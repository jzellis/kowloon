import Kowloon from "../../Kowloon.js";
export default async function (req, res) {
  let status = 200;
  // console.log(req.headers);
  let decrypted = await Kowloon.verifyRemoteRequest(
    req.body.actorId,
    req.body.token
  );

  let response = decrypted || false;
  res.set("Content-Type", "application/text").status(status).send(response);
}
