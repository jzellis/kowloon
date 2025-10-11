// scripts/describeSchemas.js
// Usage:
//   node scripts/describeSchemas.js --pretty
//   node scripts/describeSchemas.js --pretty --out schemas.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const PRETTY = args.includes("--pretty");
const OUT_IDX = args.indexOf("--out");
const OUT_PATH = OUT_IDX !== -1 ? args[OUT_IDX + 1] : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust if your script lives elsewhere:
const SCHEMA_INDEX_PATH = path.resolve(__dirname, "../schema/index.js");

function summarizeType(schemaType) {
  const base = {
    kind: schemaType.instance || schemaType.constructor?.name || "Unknown",
    required: Boolean(schemaType.isRequired || schemaType.options?.required),
    default: schemaType.options?.default,
    unique: Boolean(schemaType.options?.unique),
    index: Boolean(schemaType._index || schemaType.options?.index),
  };
  if (schemaType.options?.ref) base.ref = schemaType.options.ref;

  if (schemaType?.$isMongooseArray || schemaType.instance === "Array") {
    base.kind = "Array";
    const caster = schemaType.caster;
    if (caster) {
      base.of = caster.instance || caster.constructor?.name || "Unknown";
      if (caster.options?.ref) base.ref = caster.options.ref;
      if (Array.isArray(caster.enumValues) && caster.enumValues.length) {
        base.enum = caster.enumValues;
      }
    }
  }

  if (Array.isArray(schemaType.enumValues) && schemaType.enumValues.length) {
    base.enum = schemaType.enumValues;
  }
  if (schemaType.schema) base.kind = "Subdocument";
  return base;
}

function buildFields(schema) {
  const fields = {};
  for (const [name, st] of Object.entries(schema.paths)) {
    if (name === "__v") continue;
    fields[name] = summarizeType(st);
  }
  return fields;
}

function buildIndexes(schema) {
  try {
    const idx = schema.indexes?.() || [];
    return idx.map(([spec, options]) => ({ spec, options: options || {} }));
  } catch {
    return [];
  }
}

function looksLikeModel(x) {
  return (
    x &&
    (typeof x === "function" || typeof x === "object") &&
    x.schema &&
    typeof x.schema === "object"
  );
}

try {
  const schemaIndexUrl = pathToFileURL(SCHEMA_INDEX_PATH).href;
  const mod = await import(schemaIndexUrl);

  const models = [];
  for (const [exportName, maybeModel] of Object.entries(mod)) {
    if (looksLikeModel(maybeModel)) {
      const schema = maybeModel.schema;
      models.push({
        model: maybeModel.modelName || exportName,
        collection: schema?.options?.collection || undefined,
        options: {
          timestamps: Boolean(schema?.options?.timestamps),
          strict: schema?.options?.strict ?? true,
        },
        fields: buildFields(schema),
        indexes: buildIndexes(schema),
      });
    }
  }

  if (models.length === 0) {
    console.error(
      "⚠️  No Mongoose models were found in ./schema/index.js.\n" +
        "   • Ensure /schema/index.js exports your models (named exports or default).\n" +
        "   • If models are registered lazily, import your DB bootstrap before running this script."
    );
    process.exitCode = 1;
  }

  const json = PRETTY
    ? JSON.stringify(models, null, 2)
    : JSON.stringify(models);
  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, json);
    console.log(
      `📝 Wrote schema description to ${OUT_PATH} (${models.length} models)`
    );
  } else {
    console.log(json);
  }
} catch (err) {
  console.error("💥 Failed to describe schemas:", err?.message || err);
  process.exitCode = 1;
}
