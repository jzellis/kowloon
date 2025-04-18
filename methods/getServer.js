// This method retrieves a user whether local or remote.

import get from "./get.js";
import { User } from "../schema/index.js";
export default async function (id) {
  let domain = id.split("@")[1];
  let req = await get(`https://${domain}`);
  return req.server || null;
}
