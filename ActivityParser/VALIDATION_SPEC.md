# ActivityParser Validation Specification

This document outlines the required and optional fields for each Activity type handler.

**Global Requirements:**
- All activities require `actorId` (string)
- All activities require `type` (string)

## Handler Validation Requirements

### ✅ Create
**Required:** objectType, object, to, canReply, canReact
**Status:** UPDATED with new pattern

### ✅ Update
**Required:** objectType, object, target
**Optional:** to, canReply, canReact
**Status:** UPDATED with new pattern

### ✅ Delete
**Required:** target
**Optional:** objectType, object, to, canReply, canReact
**Status:** UPDATED with new pattern

### ⚠️ Accept
**Required:** to (Group ID)
**Optional:** objectType, object, target, canReply, canReact
**Status:** NEEDS UPDATE

Validation logic:
```javascript
export function validate(activity) {
  const errors = [];

  if (!activity?.actorId || typeof activity.actorId !== "string") {
    errors.push("Accept: missing activity.actorId");
  }

  // Required: to (Group ID)
  if (!activity?.to || typeof activity.to !== "string") {
    errors.push("Accept: missing required field 'to' (Group ID)");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
```

### ⚠️ Add
**Required:** to (Group ID), target (User ID)
**Optional:** objectType, object, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Block
**Required:** target (User/Server ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Flag
**Required:** target (Post/Group ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ✅ Follow
**Required:** to (Circle ID), target (User/Server ID)
**Optional:** objectType, object, canReply, canReact
**Status:** UPDATED with new pattern (with backward compatibility for activity.object)

### ⚠️ Invite
**Required:** to (Group ID), target (User ID)
**Optional:** objectType, object, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Join
**Required:** target (Group ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Leave
**Required:** target (Group ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Mute
**Required:** target (User/Server ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ✅ React
**Required:** objectType, object, to (object ID)
**Optional:** canReply, canReact, target
**Status:** UPDATED with new pattern

### ⚠️ Remove
**Required:** to (Group ID), target (User ID)
**Optional:** objectType, object, canReply, canReact
**Status:** NEEDS UPDATE

### ✅ Reply
**Required:** objectType (should always be "Reply"), object, to (Post ID)
**Optional:** canReply, canReact, target
**Status:** UPDATED with new pattern

### ⚠️ Undo
**Required:** target (Activity ID)
**Optional:** objectType, object, to, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Unfollow
**Required:** to (Circle ID), target (User/Server ID)
**Optional:** objectType, object, canReply, canReact
**Status:** NEEDS UPDATE

### ⚠️ Upload
**Required:** objectType (should always be "File"), object, to, canReply, canReact
**Optional:** target (uploaded filename)
**Status:** NEEDS UPDATE

## Handler Structure Template

Each handler should follow this structure:

```javascript
import getFederationTargetsHelper from "../utils/getFederationTargets.js";

/**
 * Type-specific validation
 * @param {Object} activity
 * @returns {{ valid: boolean, errors?: string[] }}
 */
export function validate(activity) {
  const errors = [];

  // Check required fields per specification

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Determine federation targets
 * @param {Object} activity
 * @param {Object} result
 * @returns {Promise<FederationRequirements>}
 */
export async function getFederationTargets(activity, result) {
  // Return federation requirements or use helper
  return getFederationTargetsHelper(activity, result);
}

export default async function HandlerName(activity) {
  try {
    // 1. Validate
    const validation = validate(activity);
    if (!validation.valid) {
      return { activity, error: validation.errors.join("; ") };
    }

    // 2. Execute business logic
    // ... handler-specific code ...

    // 3. Determine federation requirements
    const federation = await getFederationTargets(activity, result);

    return {
      activity,
      created: result,
      result,
      federation,
    };
  } catch (err) {
    return { activity, error: err?.message || String(err) };
  }
}
```

## Federation Requirements Interface

```typescript
interface FederationRequirements {
  shouldFederate: boolean;
  scope?: 'followers' | 'domain' | 'circle' | 'group' | 'event' | 'direct';
  actorId?: string;              // For 'followers' scope
  domains?: string[];            // For 'domain' scope
  circleId?: string;             // For 'circle' scope
  groupId?: string;              // For 'group' scope
  eventId?: string;              // For 'event' scope
  inboxes?: string[];            // For 'direct' scope
  activityType?: string;         // Optional: change activity type (e.g., "Accept")
}
```

## Next Steps

The remaining handlers need to be updated with:
1. `validate(activity)` export matching the spec
2. `getFederationTargets(activity, result)` export
3. Updated main handler to use validation and return federation metadata
