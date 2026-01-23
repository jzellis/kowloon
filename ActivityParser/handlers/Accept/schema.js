// Schema definition for Accept activity type
// Accept activities approve pending join requests or self-accept invitations

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor accepting (admin or invitee)'
    },
    to: {
      required: true,
      type: 'string',
      description: 'Group ID where acceptance is happening'
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
      description: 'Optional - may contain the Join activity being accepted'
    },
    target: {
      required: false,
      type: 'string',
      description: 'Not used in Accept activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Accept activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Accept activities'
    }
  },

  federation: {
    // Accept activities never federate (local group management only)
    checkRemote: false
  }
};
