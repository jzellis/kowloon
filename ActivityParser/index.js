// /ActivityParser/index.js (ESM)
import { readdir, access } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { constants } from "fs";
import validateActivity from "./validate.js";
import preprocess from "./preprocess.js";
import kowloonId from "#methods/parse/kowloonId.js";

export default async function ActivityParser() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const HANDLERS_DIR = join(__dirname, "handlers");

  const activity = async function () {};
  activity.validate = validateActivity;

  // Load schemas for each handler
  const schemas = {};
  const entries = await readdir(HANDLERS_DIR, { withFileTypes: true });

  await Promise.all(entries.filter(e => e.isDirectory()).map(async (dirent) => {
    const verb = dirent.name;

    // Try to load schema.js
    const schemaPath = join(HANDLERS_DIR, verb, "schema.js");
    try {
      await access(schemaPath, constants.R_OK);
      const schemaUrl = pathToFileURL(schemaPath).href;
      const schemaMod = await import(schemaUrl);
      if (schemaMod.default) {
        schemas[verb] = schemaMod.default;
      }
    } catch (err) {
      // Schema file doesn't exist or isn't readable - skip
    }

    // Load handler
    const modUrl = pathToFileURL(join(HANDLERS_DIR, verb, "index.js")).href;
    const mod = await import(modUrl);
    if (typeof mod.default === "function") {
      Object.defineProperty(activity, verb, { enumerable: true, value: mod.default });
    }
  }));

  /**
   * Validate activity against type-specific schema
   * @param {Object} activity - The activity to validate
   * @param {string} type - The activity type
   * @returns {{ valid: boolean, errors?: string[] }}
   */
  function validateWithSchema(activity, type) {
    const schema = schemas[type];
    if (!schema || !schema.fields) {
      // No schema defined - skip validation
      return { valid: true };
    }

    const errors = [];

    // Check required fields
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.required) {
        const value = activity[fieldName];

        // Check if field exists and is not null/undefined
        if (value === null || value === undefined) {
          errors.push(`${type}: missing required field '${fieldName}'`);
          continue;
        }

        // Check type if specified
        if (fieldDef.type && typeof value !== fieldDef.type) {
          errors.push(`${type}: field '${fieldName}' must be of type '${fieldDef.type}'`);
        }
      }
    }

    // Run custom validation function if provided by schema
    if (typeof schema.validate === 'function') {
      const customValidation = schema.validate(activity);
      if (customValidation && customValidation.errors) {
        errors.push(...customValidation.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Apply default values from schema
   * @param {Object} activity - The activity to apply defaults to
   * @param {string} type - The activity type
   */
  function applyDefaults(activity, type) {
    const schema = schemas[type];
    if (!schema || !schema.fields) return;

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.default && !activity[fieldName]) {
        // Apply default value - can reference other fields
        if (typeof fieldDef.default === 'string' && activity[fieldDef.default]) {
          activity[fieldName] = activity[fieldDef.default];
        } else {
          activity[fieldName] = fieldDef.default;
        }
      }
    }
  }

  /**
   * Check if activity should federate based on schema
   * @param {Object} activity - The activity
   * @param {string} type - The activity type
   * @returns {{ shouldFederate: boolean }}
   */
  async function checkShouldFederate(activity, type) {
    const schema = schemas[type];
    if (!schema || !schema.federation) {
      return { shouldFederate: false };
    }

    const { checkRemote } = schema.federation;

    // If checkRemote is false, never federate
    if (checkRemote === false) {
      return { shouldFederate: false };
    }

    // If checkRemote is a field name, check if that field's value is remote
    if (typeof checkRemote === 'string') {
      const fieldValue = activity[checkRemote];
      if (!fieldValue) {
        return { shouldFederate: false };
      }

      // Check if the ID is remote using kowloonId
      const parsed = kowloonId(fieldValue);

      // Get local domain
      let localDomain;
      try {
        const Kowloon = (await import("#kowloon")).default;
        localDomain = Kowloon.settings.domain;
      } catch {
        // Can't determine local domain - don't federate
        return { shouldFederate: false };
      }

      // Check if domain is remote
      const isRemote = parsed.domain && parsed.domain !== localDomain;
      return { shouldFederate: isRemote };
    }

    return { shouldFederate: false };
  }

  activity.parse = async function parse(envelope) {
    let env;
    try { env = preprocess(envelope); } catch (e) { return { activity: envelope, error: e.message }; }
    const v = validateActivity(env);
    if (!v.valid) return { activity: env, error: v.message, errors: v.errors };
    const handler = activity[env.type];
    if (!handler) return { activity: env, error: `Unsupported activity type: ${env.type}` };

    // Apply schema-based defaults
    applyDefaults(env, env.type);

    // Validate against type-specific schema
    const schemaValidation = validateWithSchema(env, env.type);
    if (!schemaValidation.valid) {
      return { activity: env, error: schemaValidation.errors.join("; ") };
    }

    // Check if should federate based on schema
    const schemaFederation = await checkShouldFederate(env, env.type);

    // Execute handler (business logic only, no validation)
    const result = await handler(env);

    // If handler didn't return federation info, use schema-based federation
    if (!result.federation && schemaFederation.shouldFederate) {
      result.federation = schemaFederation;
    }

    // If federation requirements are returned, process them
    if (result.federation?.shouldFederate) {
      await processFederation(result.activity, result.created, result.federation);
    }

    return result;
  };

  /**
   * Process federation requirements from handler results
   * @param {Object} activity - The original activity
   * @param {Object} created - The created/updated object
   * @param {Object} federation - Federation requirements
   */
  async function processFederation(activity, created, federation) {
    try {
      // Lazy-load Kowloon to avoid circular dependencies
      const Kowloon = (await import("#kowloon")).default;

      if (!Kowloon?.federation?.sendToInboxes) {
        console.warn("Federation not available - skipping");
        return;
      }

      let inboxes = [];

      switch (federation.scope) {
        case "followers":
          // Get all follower inboxes for the actor
          if (federation.actorId) {
            inboxes = await Kowloon.federation.getFollowerInboxes(federation.actorId);
          }
          break;

        case "domain":
          // Get inbox(es) for specific domain(s)
          if (federation.domains?.length) {
            for (const domain of federation.domains) {
              const domainInbox = `https://${domain}/inbox`;
              inboxes.push(domainInbox);
            }
          }
          break;

        case "circle":
          // Get inboxes for circle members
          if (federation.circleId) {
            inboxes = await Kowloon.federation.getCircleInboxes(federation.circleId);
          }
          break;

        case "group":
          // Get inboxes for group members
          if (federation.groupId) {
            inboxes = await Kowloon.federation.getGroupInboxes(federation.groupId);
          }
          break;

        case "direct":
          // Use provided inboxes directly
          inboxes = federation.inboxes || [];
          break;

        default:
          console.warn(`Unknown federation scope: ${federation.scope}`);
          return;
      }

      // Filter out local inboxes and duplicates
      inboxes = [...new Set(inboxes)].filter(inbox => {
        try {
          const url = new URL(inbox);
          return !Kowloon.settings.isLocalDomain?.(url.hostname);
        } catch {
          return false;
        }
      });

      if (inboxes.length > 0) {
        // For Create/Update activities, try to send the FeedItem instead of raw object
        let objectToSend = created;

        if (activity.type === 'Create' || activity.type === 'Update') {
          try {
            // Try to fetch FeedItem for this object
            const { FeedItems } = await import("#schema");
            const feedItem = await FeedItems.findOne({ id: created?.id }).lean();

            if (feedItem) {
              // Send the FeedItem representation (the public API)
              objectToSend = feedItem.object || created;
              console.log(`Federation: sending FeedItem for ${created?.id}`);
            } else {
              console.log(`Federation: no FeedItem found for ${created?.id}, sending raw object`);
            }
          } catch (err) {
            console.warn(`Federation: failed to load FeedItem for ${created?.id}, sending raw object:`, err.message);
            // Fall back to raw object
          }
        }

        // Build the activity to send (may be different from the original)
        const activityToSend = federation.activityType
          ? { ...activity, type: federation.activityType, object: objectToSend }
          : { ...activity, object: objectToSend };

        await Kowloon.federation.sendToInboxes(inboxes, activityToSend);
      }
    } catch (err) {
      console.error("Federation processing error:", err);
      // Don't throw - federation failures shouldn't break the activity
    }
  }

  Object.defineProperty(activity, "verbs", {
    enumerable: true,
    value: entries.filter(e => e.isDirectory()).map(e => e.name),
  });

  return activity;
}
