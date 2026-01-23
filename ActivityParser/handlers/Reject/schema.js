// Schema definition for Reject activity type
// Reject activities deny pending join requests or invitations

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor rejecting'
    },
    to: {
      required: true,
      type: 'string',
      description: 'Group ID where rejection is happening'
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
      description: 'Optional - may contain the Join activity being rejected'
    },
    target: {
      required: false,
      type: 'string',
      description: 'Not typically used in Reject activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Reject activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Reject activities'
    }
  },

  federation: {
    // Reject activities never federate (local group management only)
    checkRemote: false
  }
};
