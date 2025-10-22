// /ActivitySchema/validator.js
// Replaces the manual validator with AJV using the schema above.

import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "./activity.schema.js";

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validate = ajv.compile(schema);

function formatErrors(errors = []) {
  return errors
    .map((e) => {
      const path = e.instancePath || "(root)";
      const ctx = e.params ? JSON.stringify(e.params) : "";
      return `${path} ${e.message}${ctx ? " " + ctx : ""}`;
    })
    .join("; ");
}

/**
 * Validate an activity envelope.
 * @param {object} activity
 * @returns {{ valid: true } | { valid: false, message: string, errors: any[] }}
 * Throws nothing; returns a result object so callers can decide behavior.
 */
export default function validateActivity(activity) {
  const ok = validate(activity);
  if (ok) return { valid: true };
  return {
    valid: false,
    message: formatErrors(validate.errors),
    errors: validate.errors,
  };
}
