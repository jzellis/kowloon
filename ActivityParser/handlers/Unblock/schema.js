// Schema definition for Unblock activity type
// Unblock activities remove users from the blocked list

export default {
  mirror: 'Block',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor unblocking'
    },
    target: {
      required: true,
      type: 'string',
      description: 'User ID being unblocked'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Optional type information'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Optional unblock metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Unblock activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Unblock activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Unblock activities'
    }
  },

  federation: {
    // Unblock activities never federate (local blocking only)
    checkRemote: false
  }
};
