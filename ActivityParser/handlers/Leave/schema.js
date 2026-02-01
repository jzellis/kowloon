// Schema definition for Leave activity type
// Leave activities remove group membership

export default {
  mirror: 'Join',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor leaving'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Group ID being left'
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
      description: 'Optional leave metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Leave activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Leave activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Leave activities'
    }
  },

  federation: {
    // Federate if the target group is on a remote server
    checkRemote: 'target'
  }
};
