// This just retrieves the server settings from the DB and returns them as an object of key-value pairs.

import { Settings } from "../schema/index.js";

export default async function () {
  return (await Settings.findOne({ name: "moderatorUsers" })).value;
}
