// Schema definition for Flag activity type
// Flag activities report content for moderation

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor flagging content'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Content ID being flagged'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Type of content being flagged'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Optional flag reason/metadata'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Flag activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Flag activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Flag activities'
    }
  },

  federation: {
    // Flag activities never federate (local moderation only)
    checkRemote: false
  }
};
