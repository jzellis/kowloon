/* The server's root -- returns information about the server itself. */

import { Settings } from "../../schema/index.js";
export default async function (req, res) {
  let status = 200;
  let qStart = Date.now();
  let response = { settings: {} };
  const publicSettings = await Settings.find({ public: true });
  publicSettings.map((s) => {
    response.settings[s.name] = s.value;
  });
  let qEnd = Date.now();
  response.queryTime = qEnd - qStart;
  res.status(status).json(response);
}
