// /ActivityParser/index.js (ESM)
import { readdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import validateActivity from "./validate.js";
import preprocess from "./preprocess.js";

export default async function ActivityParser() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const HANDLERS_DIR = join(__dirname, "handlers");

  const activity = async function () {};
  activity.validate = validateActivity;

  const entries = await readdir(HANDLERS_DIR, { withFileTypes: true });
  await Promise.all(entries.filter(e => e.isDirectory()).map(async (dirent) => {
    const verb = dirent.name;
    const modUrl = pathToFileURL(join(HANDLERS_DIR, verb, "index.js")).href;
    const mod = await import(modUrl);
    if (typeof mod.default === "function") {
      Object.defineProperty(activity, verb, { enumerable: true, value: mod.default });
    }
  }));

  activity.parse = async function parse(envelope) {
    let env;
    try { env = preprocess(envelope); } catch (e) { return { activity: envelope, error: e.message }; }
    const v = validateActivity(env);
    if (!v.valid) return { activity: env, error: v.message, errors: v.errors };
    const handler = activity[env.type];
    if (!handler) return { activity: env, error: `Unsupported activity type: ${env.type}` };
    return handler(env);
  };

  Object.defineProperty(activity, "verbs", {
    enumerable: true,
    value: entries.filter(e => e.isDirectory()).map(e => e.name),
  });

  return activity;
}
