import { Settings } from "../schema/index.js";

export default async function (id) {
  let server = (await Settings.findOne({ name: "domain" })).value;
  return id?.split("@").length > 0 ? id?.split("@").pop() === server : false;
}
