// Schema definition for Block activity type
// Block activities block users from viewing/interacting with actor's content

export default {
  mirror: 'Unblock',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor blocking'
    },
    target: {
      required: true,
      type: 'string',
      description: 'User ID being blocked'
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
      description: 'Optional block metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Block activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Block activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Block activities'
    }
  },

  federation: {
    // Block activities never federate (local blocking only)
    checkRemote: false
  }
};
