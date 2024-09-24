import { Setting } from "../schema/index.js";

export default async function (setting) {
  try {
    return await Setting.create(setting);
  } catch (e) {
    return { error: e };
  }
}
