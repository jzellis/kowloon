// /Kowloon.js
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The singleton we'll populate and export
const kowloon = {
  settings: {},
  connection: null, // set by utils/init.js
  mongoose: null, // set by utils/init.js
  reservedUsernames: ["admin", "kowloon", "public"],
};

// Load method namespaces *on demand* (NOT at import time)
// Attaches each /methods/<domain>/index.js as Kowloon[domain]
export async function attachMethodDomains(target = kowloon) {
  const methodsDir = path.join(__dirname, "methods");
  let entries = [];
  try {
    entries = fs.readdirSync(methodsDir, { withFileTypes: true });
  } catch {
    console.warn("Kowloon: no /methods directory found");
    return target;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const name = ent.name; // e.g. "get", "parse", "settings", "utils"
    const indexPath = path.join(methodsDir, name, "index.js");
    if (!fs.existsSync(indexPath)) continue;

    try {
      const mod = await import(pathToFileURL(indexPath).href);
      const ns =
        mod && mod.default && typeof mod.default === "object"
          ? mod.default
          : mod; // accept both styles
      target[name] = ns;
      console.log(`Kowloon: methods loaded -> ${name}`);
    } catch (e) {
      console.error(`Kowloon: failed loading methods/${name}:`, e);
    }
  }
  return target;
}

const Kowloon = kowloon;
await attachMethodDomains(Kowloon);
await Kowloon.utils.init(Kowloon);

export default Kowloon;
