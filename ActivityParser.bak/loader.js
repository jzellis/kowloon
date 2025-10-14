// loader.js
import { readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_HANDLERS_ROOT = join(__dirname, "handlers");

const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = (p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};

async function loadActivityTypeFolder(dir) {
  const bucket = { entry: null, _default: null, subtypes: {}, hooks: null }; // 👈 add entry
  if (!isDir(dir)) return bucket;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".js")) continue;
    const file = join(dir, e.name);
    const name = basename(e.name, ".js");
    const mod = await import(pathToFileURL(file).href);
    const fn = mod.default || mod;

    if (name === "index") bucket.entry = fn; // 👈 new: verb entry point
    else if (name === "_default") bucket._default = fn;
    else if (name === "_hooks")
      bucket.hooks = mod; // { before?, after?, onError? }
    else bucket.subtypes[name] = fn; // Post.js → bucket.subtypes.Post
  }
  return bucket;
}

async function buildFromRoot(root) {
  const reg = {};
  if (!isDir(root)) return reg;

  const verbs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const verb of verbs) {
    const loaded = await loadActivityTypeFolder(join(root, verb));
    reg[verb] = {
      ...(reg[verb] || {}),
      ...loaded,
      subtypes: { ...(reg[verb]?.subtypes || {}), ...(loaded.subtypes || {}) },
    };
  }
  return reg;
}

let REGISTRY = null;

export async function buildRegistry() {
  const coreReg = await buildFromRoot(CORE_HANDLERS_ROOT);
  return coreReg;
}

export async function ensureRegistry() {
  if (!REGISTRY) REGISTRY = await buildRegistry();
  return REGISTRY;
}

export async function resetRegistry() {
  REGISTRY = null;
  return ensureRegistry();
}
