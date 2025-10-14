// /ActivityParser/index.js (ESM)

import { readdir } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import validateActivity from "./validate.js";

export default async function ActivityParser() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const HANDLERS_DIR = join(__dirname, "handlers");

  // Callable function object (no-op when called directly)
  const activity = async function () {};
  activity.validate = validateActivity;
  const entries = await readdir(HANDLERS_DIR, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((e) => e.isDirectory())
      .map(async (dir) => {
        const verb = dir.name; // e.g., "Create", "Dookie", etc.
        const indexPath = join(HANDLERS_DIR, verb, "index.js");
        const url = pathToFileURL(indexPath).href;

        try {
          const mod = await import(url);
          const handler = mod?.default ?? mod?.[verb];

          if (typeof handler !== "function") {
            Object.defineProperty(activity, verb, {
              enumerable: true,
              value: async () => {
                throw new Error(
                  `./handlers/${verb}/index.js must export a function (default export recommended).`
                );
              },
            });
            return;
          }

          Object.defineProperty(activity, verb, {
            enumerable: true,
            value: async (payload) => handler(payload),
          });
        } catch (err) {
          // If the folder exists but index.js is missing or failed to load,
          // attach a stub that throws a helpful error at call time.
          Object.defineProperty(activity, verb, {
            enumerable: true,
            value: async () => {
              throw new Error(
                `Failed to load ./handlers/${verb}/index.js: ${err.message}`
              );
            },
          });
        }
      })
  );

  // (Optional) expose the discovered verbs list
  Object.defineProperty(activity, "verbs", {
    enumerable: true,
    value: entries.filter((e) => e.isDirectory()).map((e) => e.name),
  });

  return activity;
}
