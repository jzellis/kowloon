import { readdirSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_HANDLERS_ROOT = join(__dirname, "handlers");
// If/when you add plugins: const PLUGINS_ROOT = join(__dirname, "../modules");

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
  // dir like ".../handlers/Create"
  const bucket = { _default: null, subtypes: {}, hooks: null };
  if (!isDir(dir)) return bucket;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".js")) continue;
    const file = join(dir, e.name);
    const name = basename(e.name, ".js");
    const mod = await import(pathToFileURL(file).href);
    const fn = mod.default || mod;

    if (name === "_default") bucket._default = fn;
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
      // hooks: last writer wins; change policy if you add plugins
    };
  }
  return reg;
}

let REGISTRY = null;

export async function buildRegistry() {
  // If later adding plugins, load them first so they override core.
  // const pluginsReg = await buildFromRoot(PLUGINS_ROOT);
  const coreReg = await buildFromRoot(CORE_HANDLERS_ROOT);

  // Merge policy (plugins first if you add them):
  // return { ...pluginsReg, ...coreReg, Verb: { ...pluginsReg.Verb, ...coreReg.Verb, subtypes: {...} } };
  return coreReg;
}

export async function ensureRegistry() {
  if (!REGISTRY) REGISTRY = await buildRegistry();
  return REGISTRY;
}

// For tests/hot-reload
export async function resetRegistry() {
  REGISTRY = null;
  return ensureRegistry();
}
