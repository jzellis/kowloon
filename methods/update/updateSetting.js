import { Settings } from "../../schema/index.js";

export default async function (name, setting) {
  try {
    return await Settings.findOneAndUpdate({ name }, { $set: setting });
  } catch (e) {
    return { error: e };
  }
}
