// Schema definition for React activity type
// React activities create reactions (emoji responses) to objects

export default {
  mirror: 'Delete', // Delete the React object to unreact

  fields: {
    // Required fields
    actorId: {
      required: true,
      type: 'string',
      description: 'ID of the actor reacting'
    },
    objectType: {
      required: true,
      type: 'string',
      description: 'Type of reaction object (should be "React")'
    },
    object: {
      required: true,
      type: 'object',
      description: 'The reaction object (contains emoji/react type)'
    },
    to: {
      required: true,
      type: 'string',
      description: 'ID of the object being reacted to'
    },

    // Optional fields (not used for React)
    canReply: {
      required: false,
      type: 'string',
      description: 'Not used in React activities'
    },
    canReact: {
      required: false,
      type: 'string',
      description: 'Not used in React activities'
    },
    target: {
      required: false,
      type: 'string',
      description: 'Not used in React activities'
    }
  },

  federation: {
    // Federate if the object being reacted to is on a remote server
    checkRemote: 'to'
  }
};
