// Schema definition for Update activity type
// Update activities modify existing objects

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor updating the object'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Type of object being updated'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The updated object data'
    },
    target: {
      required: true,
      type: 'string',
      description: 'ID of the object being updated'
    },

    // Optional fields
    to: {
      required: false,
      type: 'string',
      description: 'Optional addressing (not typically used in Update)'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Who can reply (if updating reply permissions)'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Who can react (if updating react permissions)'
    }
  },

  federation: {
    // Federate if the target object is on a remote server
    checkRemote: 'target'
  },

  /**
   * Custom validation for Update activities
   * @param {Object} activity - The activity to validate
   * @returns {{ errors?: string[] }}
   */
  validate(activity) {
    const errors = [];

    // Special validation: if 'to' is a user ID, it must equal actorId (self-addressed for private objects)
    if (activity.to && typeof activity.to === 'string') {
      const to = activity.to.trim();
      const actorId = activity.actorId;

      // Check if 'to' is a user ID pattern (@user@domain)
      const isUserPattern = /^@[^@\s]+@[a-z0-9.-]+$/i.test(to);

      if (isUserPattern && to !== actorId) {
        errors.push(`cannot address 'to' another user ('${to}'). Use 'to: actorId' for private objects, or address to @public/@domain/circle:/group:`);
      }
    }

    // Same validation for canReply and canReact
    for (const field of ['canReply', 'canReact']) {
      if (activity[field] && typeof activity[field] === 'string') {
        const value = activity[field].trim();
        const actorId = activity.actorId;

        const isUserPattern = /^@[^@\s]+@[a-z0-9.-]+$/i.test(value);

        if (isUserPattern && value !== actorId) {
          errors.push(`cannot set '${field}' to another user ('${value}'). Use '${field}: actorId' for private permissions, or address to @public/@domain/circle:/group:`);
        }
      }
    }

    return errors.length > 0 ? { errors } : {};
  }
};
