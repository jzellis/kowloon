// Schema definition for Create activity type
// Create activities create new objects (Posts, Users, Groups, etc.)

export default {
  mirror: 'Delete',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor creating the object'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Type of object being created (Post, User, Group, etc.)'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The object being created'
    },
    to: {
      required: true,
      type: 'string',
      description: 'Addressing target (audience for the created object)'
    },

    // Optional fields with defaults
    canReply: {
      required: false,
      type: 'string',
      default: 'to',
      description: 'Who can reply to this object (defaults to same as "to")'
    },
    canReact: {
      required: false,
      type: 'string',
      default: 'to',
      description: 'Who can react to this object (defaults to same as "to")'
    },

    // Not used for Create
    target: {
      required: false,
      description: 'Not used in Create activities'
    }
  },

  federation: {
    // Federate if the "to" field is addressed to a remote group/server
    checkRemote: 'to'
  },

  /**
   * Custom validation for Create activities
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
