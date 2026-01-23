# ActivityParser Handler Structure

## Overview

Each handler in `ActivityParser/handlers/{ActivityType}/index.js` should be a complete, self-contained module that:

1. **Validates** the activity structure (type-specific validation)
2. **Executes** the business logic (creates/updates database records)
3. **Determines federation** (identifies which remote servers need the activity)

## Standard Handler Export Pattern

```javascript
/**
 * Main handler function - executes the activity
 * @param {Object} activity - The preprocessed activity envelope
 * @returns {Promise<HandlerResult>}
 */
export default async function ActivityType(activity) {
  // 1. Type-specific validation (use exported validate function)
  const validation = validate(activity);
  if (!validation.valid) {
    return { activity, error: validation.errors.join('; ') };
  }

  // 2. Execute business logic
  try {
    const result = await executeActivity(activity);

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, result);

    return {
      activity,
      created: result.created,
      result: result.data,
      federation, // NEW: includes remoteInboxes, shouldFederate, etc.
    };
  } catch (err) {
    return { activity, error: err.message };
  }
}

/**
 * Type-specific validation beyond generic ActivityStreams schema
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  // Example: Create requires objectType and object
  if (!activity.objectType) {
    errors.push('Create: missing activity.objectType');
  }
  if (!activity.object || typeof activity.object !== 'object') {
    errors.push('Create: missing activity.object');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets for this activity
 * @param {Object} activity - The activity envelope
 * @param {Object} created - The created object (from executeActivity)
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, created) {
  const { to, actorId } = created || activity;

  // Determine if federation is needed
  if (to === '@public') {
    // Public posts go to all followers of the actor
    return {
      shouldFederate: true,
      scope: 'followers',
      actorId,
    };
  }

  if (to?.startsWith('@') && to !== '@public') {
    // Domain-scoped: only send to that domain
    const domain = to.slice(1);
    return {
      shouldFederate: true,
      scope: 'domain',
      domains: [domain],
    };
  }

  if (to?.startsWith('circle:')) {
    // Circle: send to all members of the circle
    return {
      shouldFederate: true,
      scope: 'circle',
      circleId: to,
    };
  }

  if (to?.startsWith('group:')) {
    // Group: send to all members of the group
    return {
      shouldFederate: true,
      scope: 'group',
      groupId: to,
    };
  }

  // Default: no federation
  return {
    shouldFederate: false,
  };
}
```

## Handler Result Interface

```typescript
interface HandlerResult {
  activity: Activity;           // The original activity (required)
  created?: Object;              // The created/modified object
  result?: any;                  // Additional result data
  error?: string;                // Error message if failed
  federation?: FederationRequirements;  // NEW: Federation metadata
}

interface FederationRequirements {
  shouldFederate: boolean;
  scope?: 'followers' | 'domain' | 'circle' | 'group' | 'direct';
  actorId?: string;              // For 'followers' scope
  domains?: string[];            // For 'domain' scope
  circleId?: string;             // For 'circle' scope
  groupId?: string;              // For 'group' scope
  inboxes?: string[];            // For 'direct' scope
}
```

## Usage in ActivityParser

The main parser would use the handler like this:

```javascript
// ActivityParser/index.js
activity.parse = async function parse(envelope) {
  let env;
  try {
    env = preprocess(envelope);
  } catch (e) {
    return { activity: envelope, error: e.message };
  }

  // Generic validation
  const v = validateActivity(env);
  if (!v.valid) {
    return { activity: env, error: v.message, errors: v.errors };
  }

  const handler = activity[env.type];
  if (!handler) {
    return { activity: env, error: `Unsupported activity type: ${env.type}` };
  }

  // Execute handler (includes type-specific validation + execution + federation)
  const result = await handler(env);

  // NEW: If federation requirements are returned, process them
  if (result.federation?.shouldFederate) {
    await processFederation(result.activity, result.created, result.federation);
  }

  return result;
};
```

## Benefits

1. **Self-documenting**: Each handler clearly defines its validation rules
2. **Testable**: Validation and federation logic can be unit tested separately
3. **Extensible**: New handlers follow same pattern
4. **Separation of concerns**: Validation, execution, and federation are separate functions
5. **Opt-in**: Handlers can export just the main function, or add validate/getFederationTargets as needed

## Migration Path

Existing handlers continue to work as-is. To add validation and federation:

1. Export a `validate(activity)` function
2. Export a `getFederationTargets(activity, created)` function
3. Call them from the main handler
4. Return `federation` in the result object

The main ActivityParser checks for these exports and uses them if available.
