// Schema definition for Follow activity type
// Follow activities establish following relationships

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor following'
    },
    target: {
      required: true,
      type: 'string',
      description: 'ID of the user/group being followed'
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
      description: 'Optional follow metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Follow activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Follow activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Follow activities'
    }
  },

  federation: {
    // Follow activities never federate (local relationship tracking only)
    checkRemote: false
  }
};
