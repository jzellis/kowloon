// Returns all public posts from the server
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
import Kowloon from "../../Kowloon.js";

export default async function (req, res) {
  console.log(req.params.id);

  let status = 200;
  let response = { activity: await Kowloon.getActivity(req.params.id) };
  res.status(status).json(response);
}
