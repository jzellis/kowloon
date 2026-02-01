// Schema definition for Remove activity type
// Remove activities remove users/items from collections

export default {
  mirror: 'Add',

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor performing the removal'
    },
    target: {
      required: true,
      type: 'string',
      description: 'Collection ID where item is being removed from'
    },

    // Optional fields
    objectType: {
      required: false,
      type: 'string',
      description: 'Type of object being removed'
    },
    object: {
      required: false,
      type: 'object',
      description: 'The item being removed'
    },
    to: {
      required: false,
      type: 'string',
      description: 'Not typically used in Remove activities'
    },
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in Remove activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in Remove activities'
    }
  },

  federation: {
    // Remove activities never federate (local collection management only)
    checkRemote: false
  }
};
