// Schema definition for Delete activity type
// Delete activities mark objects as deleted (tombstoning)

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor deleting the object'
    },
    target: {
      required: true,
      type: 'string',
      description: 'ID of the object being deleted'
    },

    // Optional fields (not used for Delete)
    objectType: {
      required: false,
      type: 'string',
      description: 'Not required for Delete (inferred from target ID)'
    },
    object: {
      required: false,
      type: 'object',
      description: 'Not used in Delete activities'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not used in Delete activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Delete activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Delete activities'
    }
  },

  federation: {
    // Federate if the target object is on a remote server
    checkRemote: 'target'
  }
};
