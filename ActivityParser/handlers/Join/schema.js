// Schema definition for Join activity type
// Join activities request or perform group membership

export default {
  mirror: 'Leave',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor joining'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Group ID being joined'
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
      description: 'Optional join metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Join activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Join activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Join activities'
    }
  },

  federation: {
    // Federate if the target group is on a remote server
    checkRemote: 'target'
  }
};
