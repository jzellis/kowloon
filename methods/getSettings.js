// This just retrieves the server settings from the DB and returns them as an object of key-value pairs.

import { Settings } from "../schema/index.js";

export default async function () {
  const response = {};
  let settings = await Settings.find();
  // if (settings.length === 0) await setup(); //
  settings = await Settings.find();
  settings.forEach(async (setting) => {
    response[setting.name] = setting.value;
  });

  return response;
}
