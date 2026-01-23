// Schema definition for Add activity type
// Add activities add users/items to collections (e.g., adding to circles/groups)

export default {
  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor performing the add'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Collection ID where item is being added'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Type of object being added'
    },
    object: {
      required: false,
      type: 'object',
      description: 'The item being added'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Add activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Add activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Add activities'
    }
  },

  federation: {
    // Add activities never federate (local collection management only)
    checkRemote: false
  }
};
