// Schema definition for Undo activity type
// Undo activities reverse previous activities

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor undoing the activity'
    },
    target: {
      required: true,
      type: 'string',
      description: 'ID of the activity or object being undone'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Optional type of the object being undone'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Optional - the activity being undone'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Undo activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Undo activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Undo activities'
    }
  },

  federation: {
    // Federate if the target being undone is on a remote server
    checkRemote: 'target'
  }
};
