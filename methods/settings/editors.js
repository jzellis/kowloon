// This just retrieves the server settings from the DB and returns them as an object of key-value pairs.

import { Settings } from "#schema";

export default async function () {
  return (await Settings.findOne({ name: "editorUsers" })).value;
}
